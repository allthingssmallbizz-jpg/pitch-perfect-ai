import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateAsset } from "@/lib/ai/anthropic";
import {
  OFFER_BUILDER_CREDIT_COST,
  OFFER_BUILDER_MAX_OUTPUT_TOKENS,
  buildOfferBuilderPrompt,
  parseOfferBuilderResponse,
} from "@/lib/ai/offerBuilder";

export const runtime = "nodejs";

const requestSchema = z.object({
  projectId: z.string().uuid(),
  extraContext: z.string().max(1000).default(""),
});

// "Offer Builder" on the discovery form — for a member who doesn't know what to name their
// webinar/offer, what to charge, or how to close, drafts a starter offer from whatever discovery
// is already filled in for this project. Same guardrail pipeline and lightweight-telemetry
// generations row as website_import/discovery_assist.
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
  const { projectId, extraContext } = parsed.data;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const guardrail = await checkGuardrails(user.id, OFFER_BUILDER_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  try {
    const { system, user: userMessage } = buildOfferBuilderPrompt(project, extraContext);
    const result = await generateAsset(system, userMessage, OFFER_BUILDER_MAX_OUTPUT_TOKENS);
    const { fields, pricingReasoning, closingMechanismReasoning } = parseOfferBuilderResponse(result.content);

    const admin = createAdminClient();
    await admin.from("generations").insert({
      user_id: user.id,
      project_id: projectId,
      asset_type: "offer_builder",
      mode: "expert",
      status: "complete",
      content: JSON.stringify({ fields, pricingReasoning, closingMechanismReasoning }),
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      credits_charged: OFFER_BUILDER_CREDIT_COST,
    });
    await decrementCredits(user.id, OFFER_BUILDER_CREDIT_COST);

    return NextResponse.json({ fields, pricingReasoning, closingMechanismReasoning });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Offer Builder failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
