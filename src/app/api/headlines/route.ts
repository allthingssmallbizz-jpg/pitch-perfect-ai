import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateAsset } from "@/lib/ai/anthropic";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";
import { getBrandVoiceBlock } from "@/lib/ai/brandVoice";
import {
  HEADLINE_LAB_CREDIT_COST,
  HEADLINE_LAB_MAX_OUTPUT_TOKENS,
  buildHeadlineLabPrompt,
  parseRatedHeadlines,
} from "@/lib/ai/headlineLab";

export const runtime = "nodejs";

const requestSchema = z.object({
  topic: z.string().trim().min(3).max(500),
  audience: z.string().trim().max(300).optional().default(""),
  promise: z.string().trim().max(300).optional().default(""),
});

// Headline Lab is the one tool that isn't scoped to a project — it's a standalone
// utility, so unlike /api/generate this doesn't look up or require a project. It still
// goes through the exact same credit/rate-limit/kill-switch/telemetry pipeline.
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
  const { topic, audience, promise } = parsed.data;

  const guardrail = await checkGuardrails(user.id, HEADLINE_LAB_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  const admin = createAdminClient();

  const { data: pendingGeneration } = await admin
    .from("generations")
    .insert({
      user_id: user.id,
      project_id: null,
      asset_type: "headline_lab",
      mode: "expert",
      status: "pending",
      credits_charged: HEADLINE_LAB_CREDIT_COST,
      input_content: JSON.stringify({ topic, audience, promise }),
    })
    .select("id")
    .single();

  if (!pendingGeneration) {
    return NextResponse.json({ error: "Could not start generation." }, { status: 500 });
  }
  const generationId = pendingGeneration.id;

  try {
    const brandVoiceBlock = await getBrandVoiceBlock(supabase, user.id);
    const systemPrompt = buildSystemPrompt("expert", brandVoiceBlock);
    const userPrompt = buildHeadlineLabPrompt(topic, audience, promise);

    const result = await generateAsset(systemPrompt, userPrompt, HEADLINE_LAB_MAX_OUTPUT_TOKENS);
    const headlines = parseRatedHeadlines(result.content);

    await admin
      .from("generations")
      .update({
        status: "complete",
        content: JSON.stringify(headlines),
        model: result.model,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        cost_usd: result.costUsd,
      })
      .eq("id", generationId);

    await decrementCredits(user.id, HEADLINE_LAB_CREDIT_COST);

    return NextResponse.json({ generationId, headlines });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await admin.from("generations").update({ status: "failed", error: message }).eq("id", generationId);

    return NextResponse.json({ error: "Generation failed. You were not charged credits." }, { status: 502 });
  }
}
