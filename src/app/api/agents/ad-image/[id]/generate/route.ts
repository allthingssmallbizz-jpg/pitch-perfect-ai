import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateAsset } from "@/lib/ai/anthropic";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";
import { getBrandVoiceBlock } from "@/lib/ai/brandVoice";
import { AD_IMAGE_CREDIT_COST, AD_IMAGE_MAX_OUTPUT_TOKENS, buildAdImageCopyPrompt, parseImageAdCopy } from "@/lib/ai/generators/adImage";
import { getAgent } from "@/lib/agents/config";
import { recordGenerationVersion } from "@/lib/generations";

export const runtime = "nodejs";

const requestSchema = z.object({ sourcePath: z.string().min(1) });

// Step 2: the browser has already uploaded the photo directly to Storage (see start/route.ts)
// at `sourcePath` — this runs the actual paid Claude call for the short, image-fitted copy
// and marks the generation complete. Compositing the photo + copy into a finished image
// happens entirely client-side afterward (AdImageClient.tsx) — no AI image generation
// involved, since current models can't reliably render legible text.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: generationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const { sourcePath } = parsed.data;

  const { data: generation } = await supabase
    .from("generations")
    .select("id, project_id, status")
    .eq("id", generationId)
    .eq("user_id", user.id)
    .single();
  if (!generation) return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  if (generation.status !== "pending") {
    return NextResponse.json({ error: "This generation has already run." }, { status: 409 });
  }
  if (!generation.project_id) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", generation.project_id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const guardrail = await checkGuardrails(user.id, AD_IMAGE_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  const admin = createAdminClient();

  try {
    const brandVoiceBlock = await getBrandVoiceBlock(supabase, user.id);
    const agentPersona = getAgent("ad_copy")?.personaInstructions;
    const systemPrompt = buildSystemPrompt("expert", brandVoiceBlock, agentPersona);
    const userPrompt = buildAdImageCopyPrompt(project);

    const result = await generateAsset(systemPrompt, userPrompt, AD_IMAGE_MAX_OUTPUT_TOKENS);
    const copy = parseImageAdCopy(result.content);

    await admin
      .from("generations")
      .update({
        status: "complete",
        content: JSON.stringify(copy),
        image_source_path: sourcePath,
        model: result.model,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        cost_usd: result.costUsd,
      })
      .eq("id", generationId);

    await recordGenerationVersion(generationId, user.id, JSON.stringify(copy), "generate", "Generated draft");
    await decrementCredits(user.id, AD_IMAGE_CREDIT_COST);

    return NextResponse.json({ generationId, copy });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await admin.from("generations").update({ status: "failed", error: message }).eq("id", generationId);
    return NextResponse.json({ error: "Generation failed. You were not charged credits." }, { status: 502 });
  }
}
