import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { parsePptOutline, classifySlideLayout } from "@/lib/ai/pptxParser";
import {
  SLIDE_MEDIA_ASSET_TYPES,
  SLIDE_IMAGE_CREDIT_COST,
  SLIDE_IMAGE_MODEL,
  SLIDE_IMAGE_SIZE,
  SLIDE_IMAGE_QUALITY,
  SLIDE_IMAGE_COST_USD_ESTIMATE,
  buildSlideImagePrompt,
} from "@/lib/ai/generators/slideMedia";

export const runtime = "nodejs";
export const maxDuration = 60;

// This app already has OPENAI_API_KEY configured for Read Aloud and Agent Annie's video
// transcription — reusing the same credential rather than needing a separate provider. Each
// route keeps its own small client, matching the existing pattern in tts/route.ts and
// video/transcription.ts rather than a shared singleton module.
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Slide images aren't configured yet — OPENAI_API_KEY is missing.");
  }
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

const requestSchema = z.object({ slideNumber: z.number().int().positive() });

// Generates one illustrative AI image for a single slide of a Build Module Slides deck (see
// SlidePreview.tsx's per-slide "Generate image" button) — always opt-in, one slide at a time,
// never automatic for a whole deck, since this is a real per-image OpenAI cost on top of this
// app's own credits. Regenerating a slide's image overwrites the same storage path/DB row rather
// than accumulating history.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const { userId, generation } = owned;

  if (!SLIDE_MEDIA_ASSET_TYPES.includes(generation.asset_type)) {
    return NextResponse.json({ error: "Slide images aren't available for this asset type yet." }, { status: 400 });
  }
  if (!generation.content?.trim()) {
    return NextResponse.json({ error: "Nothing generated yet." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { slideNumber } = parsed.data;

  const slides = parsePptOutline(generation.content);
  const slideIndex = slides.findIndex((s) => s.number === slideNumber);
  if (slideIndex === -1) return NextResponse.json({ error: "Couldn't find that slide." }, { status: 404 });
  const slide = slides[slideIndex];
  if (classifySlideLayout(slideIndex, slides.length, slide.title) !== "content") {
    return NextResponse.json(
      { error: "Images can only be added to a regular content slide, not the title, section, or closing slide." },
      { status: 400 }
    );
  }

  const guardrail = await checkGuardrails(userId, SLIDE_IMAGE_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  const admin = createAdminClient();
  const { data: project } = generation.project_id
    ? await admin.from("projects").select("industry, product").eq("id", generation.project_id).maybeSingle()
    : { data: null };

  const prompt = buildSlideImagePrompt(project ?? { industry: "", product: "" }, slide.title, slide.bullets);

  try {
    const openai = getClient();
    const result = await openai.images.generate({
      model: SLIDE_IMAGE_MODEL,
      prompt,
      size: SLIDE_IMAGE_SIZE,
      quality: SLIDE_IMAGE_QUALITY,
      n: 1,
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image came back — try again.");

    const storagePath = `${userId}/${id}/${slideNumber}.png`;
    const { error: uploadError } = await admin.storage
      .from("slide-images")
      .upload(storagePath, Buffer.from(b64, "base64"), { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error("Could not save the generated image.");

    const { error: upsertError } = await admin.from("slide_media").upsert(
      {
        generation_id: id,
        user_id: userId,
        slide_number: slideNumber,
        kind: "image",
        storage_path: storagePath,
        chart_type: null,
        chart_data: null,
        prompt,
      },
      { onConflict: "generation_id,slide_number" }
    );
    if (upsertError) throw new Error("Could not save the generated image.");

    await decrementCredits(userId, SLIDE_IMAGE_CREDIT_COST);
    await admin
      .from("generations")
      .update({ cost_usd: generation.cost_usd + SLIDE_IMAGE_COST_USD_ESTIMATE })
      .eq("id", id);

    const { data: signed } = await admin.storage.from("slide-images").createSignedUrl(storagePath, 3600);

    return NextResponse.json({ slideNumber, kind: "image", url: signed?.signedUrl ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate that image.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
