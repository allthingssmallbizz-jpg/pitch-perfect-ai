import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateAsset } from "@/lib/ai/anthropic";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";
import { getBrandVoiceBlock } from "@/lib/ai/brandVoice";
import { ASSET_GENERATORS, ASSET_TYPES } from "@/lib/ai/generators";
import { getAgent } from "@/lib/agents/config";
import { recordGenerationVersion } from "@/lib/generations";
import type { GenerationMode } from "@/types/database";

export const runtime = "nodejs";

const requestSchema = z.object({
  projectId: z.string().uuid(),
  assetType: z.enum(ASSET_TYPES as [string, ...string[]]),
  mode: z.enum(["coach", "expert"] as const),
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
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { projectId, assetType, mode } = parsed.data as {
    projectId: string;
    assetType: keyof typeof ASSET_GENERATORS;
    mode: GenerationMode;
  };

  const generator = ASSET_GENERATORS[assetType];

  // The project must belong to this user (RLS on the user-scoped client enforces this too,
  // but we look it up explicitly here since generation below runs on the admin client).
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const guardrail = await checkGuardrails(user.id, generator.creditCost);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  const admin = createAdminClient();

  const { data: pendingGeneration } = await admin
    .from("generations")
    .insert({
      user_id: user.id,
      project_id: projectId,
      asset_type: assetType,
      mode,
      status: "pending",
      credits_charged: generator.creditCost,
    })
    .select("id")
    .single();

  if (!pendingGeneration) {
    return NextResponse.json({ error: "Could not start generation." }, { status: 500 });
  }
  const generationId = pendingGeneration.id;

  try {
    const brandVoiceBlock = await getBrandVoiceBlock(supabase, user.id);
    const agentPersona = getAgent(assetType)?.personaInstructions;
    const systemPrompt = buildSystemPrompt(mode, brandVoiceBlock, agentPersona);
    const userPrompt = generator.buildPrompt(project);

    const result = await generateAsset(systemPrompt, userPrompt, generator.maxOutputTokens);

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

    await recordGenerationVersion(generationId, user.id, result.content, "generate", "Generated draft");
    await decrementCredits(user.id, generator.creditCost);

    return NextResponse.json({
      generationId,
      content: result.content,
      creditsCharged: generator.creditCost,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await admin.from("generations").update({ status: "failed", error: message }).eq("id", generationId);

    return NextResponse.json({ error: "Generation failed. You were not charged credits." }, { status: 502 });
  }
}
