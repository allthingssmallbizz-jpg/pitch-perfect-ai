import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration, recordGenerationVersion } from "@/lib/generations";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateCompleteAsset } from "@/lib/ai/anthropic";
import { WEB_PAGE_ASSET_TYPES, stripHtmlCodeFence } from "@/lib/ai/generators/htmlPage";
import { buildPageEditPrompt, PAGE_EDIT_CREDIT_COST, PAGE_EDIT_MAX_OUTPUT_TOKENS } from "@/lib/ai/generators/pageEdit";
import { parseVideoEmbedUrl } from "@/lib/videoEmbed";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z
  .object({
    instruction: z.string().trim().max(2000).default(""),
    imageUrl: z.string().url().optional(),
    // A plain source URL only — never raw HTML. The actual embed markup is built server-side by
    // parseVideoEmbedUrl from a narrowly-validated video ID, specifically so a client can never
    // get arbitrary HTML inserted into a page via this endpoint (see videoEmbed.ts).
    videoUrl: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.instruction.trim().length > 0 || data.imageUrl || data.videoUrl, {
    message: "Describe a change, attach a photo, or add a video link.",
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  let videoEmbedHtml: string | undefined;
  if (parsed.data.videoUrl) {
    const parsedVideo = parseVideoEmbedUrl(parsed.data.videoUrl);
    if (!parsedVideo) {
      return NextResponse.json(
        { error: "Couldn't recognize that as a YouTube, Vimeo, or direct video (.mp4/.webm/.mov) link." },
        { status: 400 }
      );
    }
    videoEmbedHtml = parsedVideo.html;
  }

  const guardrail = await checkGuardrails(userId, PAGE_EDIT_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  try {
    const prompt = buildPageEditPrompt(generation.content, parsed.data.instruction, {
      imageUrl: parsed.data.imageUrl,
      videoEmbedHtml,
    });
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

    const versionLabel = parsed.data.instruction.trim()
      ? `Update: ${parsed.data.instruction.slice(0, 80)}`
      : videoEmbedHtml
        ? "Update: added a video"
        : "Update: added a photo";
    await recordGenerationVersion(id, userId, updated, "edit", versionLabel);
    await decrementCredits(userId, PAGE_EDIT_CREDIT_COST);

    return NextResponse.json({ content: updated, creditsCharged: PAGE_EDIT_CREDIT_COST });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not apply that update.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
