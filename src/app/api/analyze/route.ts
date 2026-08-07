import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateAsset } from "@/lib/ai/anthropic";
import {
  ANALYZER_CREDIT_COST,
  ANALYZER_MAX_OUTPUT_TOKENS,
  ANALYZER_MAX_INPUT_CHARS,
  PRESENTATION_TYPE_LABELS,
  buildAnalyzerUserPrompt,
  getAnalyzerSystemPrompt,
} from "@/lib/ai/analyzer";

export const runtime = "nodejs";

const presentationTypes = Object.keys(PRESENTATION_TYPE_LABELS) as [string, ...string[]];

const requestSchema = z.object({
  projectId: z.string().uuid(),
  presentationType: z.enum(presentationTypes),
  content: z
    .string()
    .trim()
    .min(200, "Paste at least a few paragraphs — a full analysis needs real content to work with.")
    .max(ANALYZER_MAX_INPUT_CHARS, `Content is too long — keep it under ${ANALYZER_MAX_INPUT_CHARS.toLocaleString()} characters.`),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { projectId, presentationType, content } = parsed.data as {
    projectId: string;
    presentationType: keyof typeof PRESENTATION_TYPE_LABELS;
    content: string;
  };

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const guardrail = await checkGuardrails(user.id, ANALYZER_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  const admin = createAdminClient();

  const { data: pendingGeneration } = await admin
    .from("generations")
    .insert({
      user_id: user.id,
      project_id: projectId,
      asset_type: "presentation_analysis",
      mode: "expert",
      status: "pending",
      credits_charged: ANALYZER_CREDIT_COST,
      input_content: content,
    })
    .select("id")
    .single();

  if (!pendingGeneration) {
    return NextResponse.json({ error: "Could not start analysis." }, { status: 500 });
  }
  const generationId = pendingGeneration.id;

  try {
    const userPrompt = buildAnalyzerUserPrompt(presentationType, content);
    const result = await generateAsset(getAnalyzerSystemPrompt(), userPrompt, ANALYZER_MAX_OUTPUT_TOKENS);

    await admin
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

    await decrementCredits(user.id, ANALYZER_CREDIT_COST);

    return NextResponse.json({
      generationId,
      content: result.content,
      creditsCharged: ANALYZER_CREDIT_COST,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    await admin.from("generations").update({ status: "failed", error: message }).eq("id", generationId);

    return NextResponse.json({ error: "Analysis failed. You were not charged credits." }, { status: 502 });
  }
}
