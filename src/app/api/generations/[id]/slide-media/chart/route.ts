import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";
import { parsePptOutline, classifySlideLayout } from "@/lib/ai/pptxParser";
import { SLIDE_MEDIA_ASSET_TYPES, SLIDE_CHART_TYPES, SLIDE_CHART_MAX_POINTS, isSlideChartType } from "@/lib/ai/generators/slideMedia";

export const runtime = "nodejs";

// Charts are member-entered data (a label + a number per row), not an AI call — no OpenAI cost,
// so no credit charge either. Stored as plain data and rendered as a real, native, editable
// PowerPoint chart object in the export (see pptxDeckBuilder.ts's addChart call), not a picture.
const requestSchema = z
  .object({
    slideNumber: z.number().int().positive(),
    chartType: z.string().refine(isSlideChartType, { message: `Chart type must be one of: ${SLIDE_CHART_TYPES.join(", ")}` }),
    title: z.string().trim().max(120).optional(),
    labels: z.array(z.string().trim().min(1).max(60)).min(2).max(SLIDE_CHART_MAX_POINTS),
    values: z.array(z.number().finite()).min(2).max(SLIDE_CHART_MAX_POINTS),
  })
  .refine((d) => d.labels.length === d.values.length, { message: "Each label needs a matching value." });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const { userId, generation } = owned;

  if (!SLIDE_MEDIA_ASSET_TYPES.includes(generation.asset_type)) {
    return NextResponse.json({ error: "Slide charts aren't available for this asset type yet." }, { status: 400 });
  }
  if (!generation.content?.trim()) {
    return NextResponse.json({ error: "Nothing generated yet." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { slideNumber, chartType, title, labels, values } = parsed.data;

  const slides = parsePptOutline(generation.content);
  const slideIndex = slides.findIndex((s) => s.number === slideNumber);
  if (slideIndex === -1) return NextResponse.json({ error: "Couldn't find that slide." }, { status: 404 });
  const slide = slides[slideIndex];
  if (classifySlideLayout(slideIndex, slides.length, slide.title) !== "content") {
    return NextResponse.json(
      { error: "Charts can only be added to a regular content slide, not the title, section, or closing slide." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  // Switching a slide from a previously-generated image to a chart — clean up the now-orphaned
  // file rather than leaving it in storage forever.
  const { data: existing } = await admin
    .from("slide_media")
    .select("kind, storage_path")
    .eq("generation_id", id)
    .eq("slide_number", slideNumber)
    .maybeSingle();
  if (existing?.kind === "image" && existing.storage_path) {
    await admin.storage.from("slide-images").remove([existing.storage_path]);
  }

  const { error: upsertError } = await admin.from("slide_media").upsert(
    {
      generation_id: id,
      user_id: userId,
      slide_number: slideNumber,
      kind: "chart",
      storage_path: null,
      chart_type: chartType,
      chart_data: { labels, values },
      prompt: title ?? null,
    },
    { onConflict: "generation_id,slide_number" }
  );
  if (upsertError) return NextResponse.json({ error: "Could not save that chart." }, { status: 500 });

  return NextResponse.json({ slideNumber, kind: "chart", chartType, labels, values, title: title ?? null });
}
