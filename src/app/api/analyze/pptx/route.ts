import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractPptxText, PptxParseError } from "@/lib/pptx";

export const runtime = "nodejs";

// Plenty for a text-only slide deck — this only reads the text layer, so embedded images/video
// in a much larger file don't matter and aren't extracted anyway.
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// Pure mechanical text extraction (no AI call) — free, same as scraping a website for Import
// from your website. The credit charge happens only when the extracted text is actually
// submitted to Annie via /api/analyze.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (!/\.pptx$/i.test(file.name)) {
    return NextResponse.json(
      {
        error:
          "Only .pptx files are supported — older .ppt files need to be re-saved as .pptx first (File → Save As → PowerPoint Presentation).",
      },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `That file is too large — keep it under ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { text, slideCount } = await extractPptxText(buffer);
    return NextResponse.json({ text, slideCount });
  } catch (err) {
    const message = err instanceof PptxParseError ? err.message : "Could not read that PowerPoint file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
