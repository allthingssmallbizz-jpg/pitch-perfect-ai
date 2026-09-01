import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateAsset } from "@/lib/ai/anthropic";
import {
  IHELP_BUILDER_CREDIT_COST,
  IHELP_BUILDER_MAX_OUTPUT_TOKENS,
  buildIHelpBuilderPrompt,
  parseIHelpStatements,
} from "@/lib/ai/ihelpBuilder";

export const runtime = "nodejs";

const requestSchema = z.object({
  audience: z.string().trim().min(3).max(300),
  outcome: z.string().trim().min(3).max(300),
  mechanism: z.string().trim().min(3).max(300),
  painPoint: z.string().trim().max(300).optional().default(""),
});

// Same as /api/headlines — not scoped to a project. Purely stateless text-in/text-out: the
// candidate statements are generated from whatever audience/outcome/mechanism the caller passes,
// with no read of the account's niche bio profiles — saving the chosen one back onto a specific
// niche happens separately, via updatePresenterBio (src/lib/actions/presenterBio.ts).
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
  const { audience, outcome, mechanism, painPoint } = parsed.data;

  const guardrail = await checkGuardrails(user.id, IHELP_BUILDER_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  const admin = createAdminClient();

  const { data: pendingGeneration } = await admin
    .from("generations")
    .insert({
      user_id: user.id,
      project_id: null,
      asset_type: "ihelp_builder",
      mode: "expert",
      status: "pending",
      credits_charged: IHELP_BUILDER_CREDIT_COST,
      input_content: JSON.stringify({ audience, outcome, mechanism, painPoint }),
    })
    .select("id")
    .single();

  if (!pendingGeneration) {
    return NextResponse.json({ error: "Could not start generation." }, { status: 500 });
  }
  const generationId = pendingGeneration.id;

  try {
    const userPrompt = buildIHelpBuilderPrompt(audience, outcome, mechanism, painPoint);
    const result = await generateAsset(
      "You are a direct-response positioning strategist.",
      userPrompt,
      IHELP_BUILDER_MAX_OUTPUT_TOKENS
    );
    const statements = parseIHelpStatements(result.content);

    await admin
      .from("generations")
      .update({
        status: "complete",
        content: JSON.stringify(statements),
        model: result.model,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        cost_usd: result.costUsd,
      })
      .eq("id", generationId);

    await decrementCredits(user.id, IHELP_BUILDER_CREDIT_COST);

    return NextResponse.json({ generationId, statements });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await admin.from("generations").update({ status: "failed", error: message }).eq("id", generationId);

    return NextResponse.json({ error: "Generation failed. You were not charged credits." }, { status: 502 });
  }
}
