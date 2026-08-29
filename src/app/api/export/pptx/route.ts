import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";
import { parsePptOutline } from "@/lib/ai/pptxParser";
import { buildDeck, resolveTheme } from "@/lib/pptxDeckBuilder";

export const runtime = "nodejs";

// Turns a PPT Outline generation's markdown into a real, designed .pptx — title/section/content/
// closing layouts (see pptxDeckBuilder.ts), the member's own brand colors when they've set them,
// on-slide bullets, and speaker notes in the Notes pane. Only meaningful for asset_type
// "ppt_outline" (its markdown structure is what parsePptOutline expects); every other asset type
// still exports through PDF/.docx.
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
    return NextResponse.json({ error: "Slide export is only available for Your Webinar decks." }, { status: 400 });
  }

  const slides = parsePptOutline(generation.content);
  if (slides.length === 0) {
    return NextResponse.json({ error: "Couldn't find any slides to export in this outline." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: project }, { data: brandVoice }] = await Promise.all([
    generation.project_id
      ? admin.from("projects").select("name").eq("id", generation.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("brand_voices")
      .select("primary_color, secondary_color, accent_color, outline_color")
      .eq("user_id", generation.user_id)
      .maybeSingle(),
  ]);

  const theme = resolveTheme(brandVoice);
  const brandName = project?.name?.trim() || "Pitch Perfect AI";

  const pptx = buildDeck(slides, theme, brandName);
  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="powerpoint-outline.pptx"`,
    },
  });
}
