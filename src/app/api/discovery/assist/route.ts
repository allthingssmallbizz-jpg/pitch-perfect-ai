import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateAsset } from "@/lib/ai/anthropic";
import { getBrandVoiceBlock } from "@/lib/ai/brandVoice";
import {
  DISCOVERY_ASSIST_CREDIT_COST,
  DISCOVERY_ASSIST_MAX_OUTPUT_TOKENS,
  buildDiscoveryAssistPrompt,
} from "@/lib/ai/discoveryAssist";

export const runtime = "nodejs";

const requestSchema = z.object({
  projectId: z.string().uuid().optional(),
  fieldKey: z.string().min(1).max(100),
  fieldLabel: z.string().min(1).max(200),
  fieldType: z.enum(["text", "textarea", "select"]),
  fieldPlaceholder: z.string().max(500).optional(),
  options: z.array(z.string()).max(20).optional(),
  userPrompt: z.string().max(2000).default(""),
  otherAnswers: z.record(z.string(), z.string()).default({}),
});

// Drafts a single discovery-field answer when the user is stuck — see
// src/lib/ai/discoveryAssist.ts for the per-field guidance that grounds the draft. Same
// guardrail pipeline as every other paid call; logs a lightweight generations row purely for
// cost telemetry (see supabase/migrations/0009_discovery_assist.sql).
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
  const { projectId, fieldKey, fieldLabel, fieldType, fieldPlaceholder, options, userPrompt, otherAnswers } = parsed.data;

  const guardrail = await checkGuardrails(user.id, DISCOVERY_ASSIST_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  try {
    const brandVoiceBlock = await getBrandVoiceBlock(supabase, user.id);
    const { system, user: userMessage } = buildDiscoveryAssistPrompt({
      fieldKey,
      fieldLabel,
      fieldType,
      fieldPlaceholder,
      options,
      userPrompt,
      otherAnswers,
    });

    const result = await generateAsset(
      system,
      brandVoiceBlock ? `${userMessage}\n\n${brandVoiceBlock}` : userMessage,
      DISCOVERY_ASSIST_MAX_OUTPUT_TOKENS
    );

    let text = result.content.trim();
    text = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```\s*$/i, "");
    text = text.replace(/^["']|["']$/g, "");

    const admin = createAdminClient();
    await admin.from("generations").insert({
      user_id: user.id,
      project_id: projectId ?? null,
      asset_type: "discovery_assist",
      mode: "expert",
      status: "complete",
      content: text,
      input_content: `field=${fieldKey}`,
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      credits_charged: DISCOVERY_ASSIST_CREDIT_COST,
    });
    await decrementCredits(user.id, DISCOVERY_ASSIST_CREDIT_COST);

    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI assist failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
