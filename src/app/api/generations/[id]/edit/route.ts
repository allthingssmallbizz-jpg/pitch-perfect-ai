import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration, recordGenerationVersion } from "@/lib/generations";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateCompleteAsset } from "@/lib/ai/anthropic";
import { WEB_PAGE_ASSET_TYPES, stripHtmlCodeFence } from "@/lib/ai/generators/htmlPage";
import { buildPageEditPrompt, PAGE_EDIT_CREDIT_COST, PAGE_EDIT_MAX_OUTPUT_TOKENS } from "@/lib/ai/generators/pageEdit";
import { parseVideoEmbedUrl, upsertVideoEmbed, removeVideoEmbed } from "@/lib/videoEmbed";

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
    removeVideo: z.boolean().optional(),
  })
  .refine((data) => data.instruction.trim().length > 0 || data.imageUrl || data.videoUrl || data.removeVideo, {
    message: "Describe a change, attach a photo, or add a video link.",
  });

// The "ask for an update" panel's endpoint — a targeted edit to an already-generated Landing/
// Thank You Page. Two very different mechanisms live here:
// 1. Video add/replace/remove is a plain, deterministic string operation (upsertVideoEmbed/
//    removeVideoEmbed) — NOT an AI call. Routing video through a freeform AI edit is exactly what
//    caused it before: the AI sometimes wrote a description instead of a real embed, or mangled
//    the markup, and every retry added ANOTHER video block instead of replacing the broken one.
//    A marker-based replace fixes both — same block, updated in place, every time — and it's free
//    (no credits, since no AI call happens for a video-only request).
// 2. Everything else (a text instruction, or a photo) still goes through generateCompleteAsset
//    with the dedicated edit-only prompt (pageEdit.ts).
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

  let workingContent = generation.content;
  let videoChanged = false;

  if (parsed.data.removeVideo) {
    workingContent = removeVideoEmbed(workingContent);
    videoChanged = true;
  } else if (parsed.data.videoUrl) {
    const parsedVideo = parseVideoEmbedUrl(parsed.data.videoUrl);
    if (!parsedVideo) {
      return NextResponse.json(
        { error: "Couldn't recognize that as a YouTube, Vimeo, or direct video (.mp4/.webm/.mov) link." },
        { status: 400 }
      );
    }
    workingContent = upsertVideoEmbed(workingContent, parsedVideo.html);
    videoChanged = true;
  }

  const admin = createAdminClient();
  const needsAiEdit = Boolean(parsed.data.instruction.trim() || parsed.data.imageUrl);

  // A pure video add/replace/remove (no text instruction, no photo) never touches the AI at
  // all — save the deterministic result directly and stop here, free of charge.
  if (videoChanged && !needsAiEdit) {
    const { error: updateError } = await admin.from("generations").update({ content: workingContent }).eq("id", id);
    if (updateError) return NextResponse.json({ error: "Could not save the update." }, { status: 500 });

    await recordGenerationVersion(
      id,
      userId,
      workingContent,
      "edit",
      parsed.data.removeVideo ? "Update: removed the video" : "Update: added/replaced the video"
    );

    return NextResponse.json({ content: workingContent, creditsCharged: 0 });
  }

  const guardrail = await checkGuardrails(userId, PAGE_EDIT_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  try {
    const prompt = buildPageEditPrompt(workingContent, parsed.data.instruction, { imageUrl: parsed.data.imageUrl });
    const result = await generateCompleteAsset(
      "You are a precise web page editor. You make exactly the change requested and leave everything else untouched.",
      prompt,
      PAGE_EDIT_MAX_OUTPUT_TOKENS
    );
    const updated = stripHtmlCodeFence(result.content);

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
      : videoChanged
        ? "Update: added a video + a photo"
        : "Update: added a photo";
    await recordGenerationVersion(id, userId, updated, "edit", versionLabel);
    await decrementCredits(userId, PAGE_EDIT_CREDIT_COST);

    return NextResponse.json({ content: updated, creditsCharged: PAGE_EDIT_CREDIT_COST });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not apply that update.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
