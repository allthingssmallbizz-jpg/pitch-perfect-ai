import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration, recordGenerationVersion } from "@/lib/generations";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateCompleteAsset } from "@/lib/ai/anthropic";
import { WEB_PAGE_ASSET_TYPES, stripHtmlCodeFence } from "@/lib/ai/generators/htmlPage";
import { buildPageEditPrompt, PAGE_EDIT_CREDIT_COST, PAGE_EDIT_MAX_OUTPUT_TOKENS } from "@/lib/ai/generators/pageEdit";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({
  instruction: z.string().trim().min(1).max(2000),
  imageUrl: z.string().url().optional(),
});

// The "ask for an update" panel's endpoint — a targeted edit to an already-generated Landing/
// Thank You Page ("change the headline to X," "add a photo here"), not a full regeneration.
// Reuses the exact same generateCompleteAsset call every other generator uses, just with a
// dedicated edit-only prompt (pageEdit.ts) that's instructed to touch only what was asked.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const { userId, generation } = owned;
  if (!WEB_PAGE_ASSET_TYPES.includes(generation.asset_type)) {
    return NextResponse.json({ error: "Only Landing Pages and Thank You Pages can be edited this way." }, { status: 400 });
  }
  if (!generation.content?.trim()) {
    return NextResponse.json({ error: "Nothing generated yet." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please describe the change you want." }, { status: 400 });
  }

  const guardrail = await checkGuardrails(userId, PAGE_EDIT_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  try {
    const prompt = buildPageEditPrompt(generation.content, parsed.data.instruction, parsed.data.imageUrl);
    const result = await generateCompleteAsset(
      "You are a precise web page editor. You make exactly the change requested and leave everything else untouched.",
      prompt,
      PAGE_EDIT_MAX_OUTPUT_TOKENS
    );
    const updated = stripHtmlCodeFence(result.content);

    const admin = createAdminClient();
    // Adds this call's tokens/cost onto the generation's running total (rather than overwriting
    // it) so admin-side cost tracking reflects every edit made to this asset, not just its
    // original generation.
    const { error: updateError } = await admin
      .from("generations")
      .update({
        content: updated,
        model: result.model,
        input_tokens: generation.input_tokens + result.inputTokens,
        output_tokens: generation.output_tokens + result.outputTokens,
        cost_usd: generation.cost_usd + result.costUsd,
      })
      .eq("id", id);
    if (updateError) throw new Error("Could not save the update.");

    await recordGenerationVersion(id, userId, updated, "edit", `Update: ${parsed.data.instruction.slice(0, 80)}`);
    await decrementCredits(userId, PAGE_EDIT_CREDIT_COST);

    return NextResponse.json({ content: updated, creditsCharged: PAGE_EDIT_CREDIT_COST });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not apply that update.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
