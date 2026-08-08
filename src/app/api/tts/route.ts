import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { TTS_CREDIT_COST, TTS_MAX_CHARS, TTS_VOICE_IDS, estimateTtsCostUsd } from "@/lib/ai/tts";

export const runtime = "nodejs";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

const requestSchema = z.object({
  text: z.string().trim().min(1).max(TTS_MAX_CHARS),
  voice: z.enum(TTS_VOICE_IDS).default("alloy"),
});

// Narrates a chunk of already-generated content aloud (Read Aloud in the generator/analyzer
// views). Goes through the same guardrail pipeline as every paid call — see the comment in
// supabase/migrations/0007_tts.sql for why this logs its own lightweight `generations` row
// (cost telemetry) even though there's no content to browse back to afterward.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const { text, voice } = parsed.data;

  const guardrail = await checkGuardrails(user.id, TTS_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  const admin = createAdminClient();
  const costUsd = estimateTtsCostUsd(text.length);

  try {
    const openai = getClient();
    const speech = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
      response_format: "mp3",
    });
    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    await admin.from("generations").insert({
      user_id: user.id,
      project_id: null,
      asset_type: "tts_narration",
      mode: "expert",
      status: "complete",
      cost_usd: costUsd,
      credits_charged: TTS_CREDIT_COST,
      input_content: `voice=${voice} chars=${text.length}`,
    });
    await decrementCredits(user.id, TTS_CREDIT_COST);

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Voice playback failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
