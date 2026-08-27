import { NextRequest, NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
import { getOwnedGeneration } from "@/lib/generations";
import { parsePptOutline } from "@/lib/ai/pptxParser";

export const runtime = "nodejs";

const ACCENT = "6D5EF0";
const DARK = "1A1A2E";
const LIGHT_TEXT = "F5F5F7";
const BODY_TEXT = "2B2B3A";

// Turns a PPT Outline generation's markdown into a real, downloadable .pptx — actual slides with
// a title, on-slide bullets, and speaker notes in the Notes pane, not just a text file with
// "Slide 1:" written in it. Only meaningful for asset_type "ppt_outline" (its markdown structure
// is what parsePptOutline expects); every other asset type still exports through PDF/.docx.
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
    return NextResponse.json({ error: "Slide export is only available for PowerPoint Outlines." }, { status: 400 });
  }

  const slides = parsePptOutline(generation.content);
  if (slides.length === 0) {
    return NextResponse.json({ error: "Couldn't find any slides to export in this outline." }, { status: 400 });
  }

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "PP_WIDESCREEN", width: 13.33, height: 7.5 });
  pptx.layout = "PP_WIDESCREEN";

  for (const parsed of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };

    // A slim colored header bar rather than a plain white slide — makes the deck look like a
    // real, designed presentation instead of the outline pasted onto blank slides.
    slide.addShape("rect", { x: 0, y: 0, w: "100%", h: 1.15, fill: { color: DARK } });
    slide.addShape("rect", { x: 0, y: 1.15, w: "100%", h: 0.06, fill: { color: ACCENT } });

    slide.addText(String(parsed.number), {
      x: 0.4,
      y: 0.15,
      w: 0.9,
      h: 0.85,
      fontSize: 14,
      color: ACCENT,
      bold: true,
      align: "left",
      valign: "middle",
    });

    slide.addText(parsed.title, {
      x: 1.2,
      y: 0.15,
      w: 11.7,
      h: 0.85,
      fontSize: 24,
      bold: true,
      color: LIGHT_TEXT,
      align: "left",
      valign: "middle",
      fontFace: "Arial",
    });

    if (parsed.bullets.length > 0) {
      slide.addText(
        parsed.bullets.map((b) => ({ text: b, options: { bullet: { code: "2022" }, breakLine: true } })),
        {
          x: 0.8,
          y: 1.7,
          w: 11.7,
          h: 5.3,
          fontSize: 20,
          color: BODY_TEXT,
          valign: "top",
          fontFace: "Arial",
          lineSpacingMultiple: 1.3,
        }
      );
    }

    if (parsed.notes) {
      slide.addNotes(parsed.notes);
    }
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="powerpoint-outline.pptx"`,
    },
  });
}
