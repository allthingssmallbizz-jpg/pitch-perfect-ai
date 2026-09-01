import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";
import { parsePptOutline, parseWebinarScriptBySlideNumber } from "@/lib/ai/pptxParser";
import { buildDeck, resolveTheme } from "@/lib/pptxDeckBuilder";

export const runtime = "nodejs";

// Turns a PPT Outline generation's markdown into a real, designed .pptx — title/section/content/
// closing layouts (see pptxDeckBuilder.ts), the member's own brand colors when they've set them,
// on-slide bullets, and speaker notes in the actual Notes pane (never on the visible slide — see
// looksLikeSpokenProse in pptxParser.ts for how a mislabeled note gets kept off the slide even
// when Claude forgets the "Speaker notes" label). Prefers a completed Webinar Script for this same
// project as the notes source when one exists — see the scriptRow query below. Only meaningful for
// asset_type "ppt_outline" (its markdown structure is what parsePptOutline expects); every other
// asset type still exports through PDF/.docx.
export async function GET(req: NextRequest) {
  const generationId = req.nextUrl.searchParams.get("generationId");
  if (!generationId) return NextResponse.json({ error: "Missing generationId" }, { status: 400 });

  const owned = await getOwnedGeneration(generationId);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const { generation } = owned;

  if (!generation.content) {
    return NextResponse.json({ error: "Nothing to export yet." }, { status: 400 });
  }
  if (generation.asset_type !== "ppt_outline") {
    return NextResponse.json({ error: "Slide export is only available for Your Signature Webinar decks." }, { status: 400 });
  }

  const slides = parsePptOutline(generation.content);
  if (slides.length === 0) {
    return NextResponse.json({ error: "Couldn't find any slides to export in this outline." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: project }, { data: brandVoice }, { data: scriptRow }] = await Promise.all([
    generation.project_id
      ? admin.from("projects").select("name").eq("id", generation.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("brand_voices")
      .select("primary_color, secondary_color, accent_color, outline_color")
      .eq("user_id", generation.user_id)
      .maybeSingle(),
    // If a Webinar Script exists for this same project, its per-slide talk-track becomes the
    // real PowerPoint speaker notes automatically — the whole point of generating a proper script
    // is that nobody has to manually copy/paste it into the Notes pane themselves afterward. Falls
    // back to the deck's own short embedded notes (parsePptOutline's `.notes`) per slide when
    // there's no script yet.
    generation.project_id
      ? admin
          .from("generations")
          .select("content")
          .eq("project_id", generation.project_id)
          .eq("asset_type", "webinar_script")
          .eq("status", "complete")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const theme = resolveTheme(brandVoice);
  const brandName = project?.name?.trim() || "Pitch Perfect AI";
  const scriptBySlideNumber = scriptRow?.content ? parseWebinarScriptBySlideNumber(scriptRow.content) : undefined;

  const pptx = buildDeck(slides, theme, brandName, scriptBySlideNumber);
  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="powerpoint-outline.pptx"`,
    },
  });
}
