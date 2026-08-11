import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateAsset } from "@/lib/ai/anthropic";
import { fetchSocialProfile, SocialFetchError } from "@/lib/social";
import {
  SOCIAL_COMPARE_CREDIT_COST,
  SOCIAL_COMPARE_MAX_OUTPUT_TOKENS,
  buildSocialComparePrompt,
} from "@/lib/ai/socialCompare";
import { recordGenerationVersion } from "@/lib/generations";

export const runtime = "nodejs";
// Two external page fetches (each potentially following redirects) plus a preview-image
// download plus the Claude call can comfortably exceed a default timeout — same reasoning as
// every other multi-step generation route this session.
export const maxDuration = 60;

const requestSchema = z.object({
  yourUrl: z.string().min(1).max(500),
  referenceUrl: z.string().min(1).max(500),
});

// Agent Annie's social media comparison — reads whatever a member's own page and a
// high-performing reference page actually expose (see src/lib/social.ts for why that's Open
// Graph meta tags + preview image, not a full scraped post history) and produces a real,
// saveable/exportable markdown comparison, same as any other generator's output. Not
// project-scoped — same reasoning as Headline Lab: this doesn't read a project's discovery
// fields, only the two page addresses, so it doesn't need a project at all.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const { yourUrl, referenceUrl } = parsed.data;

  const guardrail = await checkGuardrails(user.id, SOCIAL_COMPARE_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  // Fetch both pages before charging anything or writing a row — a bad/unreachable link is the
  // member's to fix, not something they should pay credits for. Promise.allSettled (not
  // Promise.all) so a failure on one side can be reported as "your page" or "the reference page"
  // specifically, instead of an ambiguous "something went wrong."
  const [yoursResult, referenceResult] = await Promise.allSettled([
    fetchSocialProfile(yourUrl),
    fetchSocialProfile(referenceUrl),
  ]);
  if (yoursResult.status === "rejected") {
    const message = yoursResult.reason instanceof SocialFetchError ? yoursResult.reason.message : "Couldn't read that page.";
    return NextResponse.json({ error: `Your page: ${message}` }, { status: 400 });
  }
  if (referenceResult.status === "rejected") {
    const message =
      referenceResult.reason instanceof SocialFetchError ? referenceResult.reason.message : "Couldn't read that page.";
    return NextResponse.json({ error: `Reference page: ${message}` }, { status: 400 });
  }
  const yours = yoursResult.value;
  const reference = referenceResult.value;

  const admin = createAdminClient();

  const { data: pendingGeneration } = await admin
    .from("generations")
    .insert({
      user_id: user.id,
      project_id: null,
      asset_type: "social_compare",
      mode: "expert",
      status: "pending",
      credits_charged: SOCIAL_COMPARE_CREDIT_COST,
      input_content: `yours=${yours.finalUrl} reference=${reference.finalUrl}`,
    })
    .select("id")
    .single();

  if (!pendingGeneration) {
    return NextResponse.json({ error: "Could not start the comparison." }, { status: 500 });
  }
  const generationId = pendingGeneration.id;

  try {
    const { system, user: userMessage, images } = buildSocialComparePrompt(yours, reference);
    const result = await generateAsset(system, userMessage, SOCIAL_COMPARE_MAX_OUTPUT_TOKENS, images);

    const { error: updateError } = await admin
      .from("generations")
      .update({
        status: "complete",
        content: result.content,
        model: result.model,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        cost_usd: result.costUsd,
      })
      .eq("id", generationId);
    if (updateError) throw new Error(`Generated successfully but could not save: ${updateError.message}`);

    await recordGenerationVersion(generationId, user.id, result.content, "generate", "Generated comparison");
    await decrementCredits(user.id, SOCIAL_COMPARE_CREDIT_COST);

    return NextResponse.json({
      generationId,
      content: result.content,
      creditsCharged: SOCIAL_COMPARE_CREDIT_COST,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Comparison failed";
    await admin.from("generations").update({ status: "failed", error: message }).eq("id", generationId);
    return NextResponse.json({ error: "Comparison failed. You were not charged credits." }, { status: 502 });
  }
}
