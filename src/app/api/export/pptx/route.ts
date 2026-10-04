import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";
import { parsePptOutline, parseWebinarScriptBySlideNumber } from "@/lib/ai/pptxParser";
import { buildDeck, resolveTheme, type SlideMediaForExport } from "@/lib/pptxDeckBuilder";

export const runtime = "nodejs";

// Turns a PPT Outline generation's markdown into a real, designed .pptx — title/section/content/
// closing layouts (see pptxDeckBuilder.ts), the member's own brand colors when they've set them,
// on-slide bullets, and speaker notes in the actual Notes pane (never on the visible slide — see
// looksLikeSpokenProse in pptxParser.ts for how a mislabeled note gets kept off the slide even
// when Claude forgets the "Speaker notes" label). Prefers a completed Webinar Script for this same
// project as the notes source when one exists — see the scriptRow query below. Only meaningful for
// asset_type "ppt_outline" (its markdown structure is what parsePptOutline expects); every other
// asset type still exports through PDF/.docx.
//
// Build Module Slides (Agent Cora's course-module teaching decks) reuses this same route —
// its markdown deliberately uses the identical "Slide #: Title" / "On-slide content" /
// "Speaker notes" labels parsePptOutline expects (see courseModuleSlides.ts), so no separate
// parser or deck builder was needed, just letting this asset type through the check below.
const PPTX_EXPORTABLE_ASSET_TYPES = ["ppt_outline", "course_module_slides"];

export async function GET(req: NextRequest) {
  const generationId = req.nextUrl.searchParams.get("generationId");
  if (!generationId) return NextResponse.json({ error: "Missing generationId" }, { status: 400 });

  const owned = await getOwnedGeneration(generationId);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const { generation } = owned;

  if (!generation.content) {
    return NextResponse.json({ error: "Nothing to export yet." }, { status: 400 });
  }
  if (!PPTX_EXPORTABLE_ASSET_TYPES.includes(generation.asset_type)) {
    return NextResponse.json(
      { error: "Slide export is only available for Your Signature Webinar decks and Course Module Slides." },
      { status: 400 }
    );
  }

  const slides = parsePptOutline(generation.content);
  if (slides.length === 0) {
    return NextResponse.json({ error: "Couldn't find any slides to export in this outline." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: project }, { data: brandVoice }, { data: mediaRows }] = await Promise.all([
    generation.project_id
      ? admin.from("projects").select("name").eq("id", generation.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("brand_voices")
      .select("primary_color, secondary_color, accent_color, outline_color")
      .eq("user_id", generation.user_id)
      .maybeSingle(),
    // Member-added per-slide images/charts (see /api/generations/[id]/slide-media and
    // slideMedia.ts) — optional, so most generations simply have none of these rows.
    admin.from("slide_media").select("slide_number, kind, storage_path, chart_type, chart_data, prompt").eq("generation_id", generation.id),
  ]);

  // If a Webinar Script exists for this EXACT deck, its per-slide talk-track becomes the real
  // PowerPoint speaker notes automatically — the whole point of generating a proper script is
  // that nobody has to manually copy/paste it into the Notes pane themselves afterward. Falls
  // back to the deck's own short embedded notes (parsePptOutline's `.notes`) per slide when
  // there's no script yet. Only meaningful for ppt_outline itself — Webinar Script is Your
  // Signature Webinar's own pair, not Build Module Slides'.
  //
  // Prefers a script explicitly linked to THIS deck (source_generation_id — see
  // 0043_webinar_script_source.sql) over "whichever script is most recent for the project," since
  // a project can have several deck versions and this export is for one specific one. Falls back
  // to the old "most recent for the project" lookup only for a script generated before that
  // column existed (source_generation_id null), so older projects don't lose their script export.
  let scriptRow: { content: string | null } | null = null;
  if (generation.project_id && generation.asset_type === "ppt_outline") {
    const { data: linkedScript } = await admin
      .from("generations")
      .select("content")
      .eq("source_generation_id", generation.id)
      .eq("asset_type", "webinar_script")
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    scriptRow = linkedScript;
    if (!scriptRow) {
      const { data: fallbackScript } = await admin
        .from("generations")
        .select("content")
        .eq("project_id", generation.project_id)
        .eq("asset_type", "webinar_script")
        .is("source_generation_id", null)
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      scriptRow = fallbackScript;
    }
  }

  const theme = resolveTheme(brandVoice);
  const brandName = project?.name?.trim() || "Pitch Perfect AI";
  const scriptBySlideNumber = scriptRow?.content ? parseWebinarScriptBySlideNumber(scriptRow.content) : undefined;

  // Images are stored as raw files in the private slide-images bucket, not inline — fetch each
  // one's bytes now so buildDeck can embed it directly as base64 (pptxgenjs needs the actual
  // image data, not a URL). Charts need no fetch at all; their data was already stored inline.
  const mediaBySlideNumber = new Map<number, SlideMediaForExport>();
  for (const row of mediaRows ?? []) {
    if (row.kind === "chart" && row.chart_type && row.chart_data) {
      const data = row.chart_data as { labels: string[]; values: number[] };
      mediaBySlideNumber.set(row.slide_number, {
        kind: "chart",
        chartType: row.chart_type as "bar" | "line" | "pie",
        labels: data.labels,
        values: data.values,
        title: row.prompt ?? undefined,
      });
    } else if (row.kind === "image" && row.storage_path) {
      const { data: file } = await admin.storage.from("slide-images").download(row.storage_path);
      if (file) {
        const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
        mediaBySlideNumber.set(row.slide_number, { kind: "image", base64 });
      }
    }
  }

  const pptx = buildDeck(slides, theme, brandName, scriptBySlideNumber, mediaBySlideNumber);
  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

  const filename = generation.asset_type === "course_module_slides" ? "course-module-slides.pptx" : "powerpoint-outline.pptx";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
