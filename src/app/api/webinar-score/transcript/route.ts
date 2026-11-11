import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTranscriptText, TranscriptParseError } from "@/lib/transcript";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Reads an uploaded transcript (.txt / .vtt / .srt / .docx) into plain spoken text for Score My
// Webinar. Mechanical only (no AI call), so it's free — credits are charged only when the text is
// actually scored.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "That file is too large — keep it under 10MB." }, { status: 400 });
  }

  try {
    const text = await extractTranscriptText(file.name, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof TranscriptParseError ? err.message : "Could not read that transcript file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
