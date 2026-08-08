import fs from "node:fs";
import OpenAI from "openai";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

// $ per minute of audio. Verify against https://openai.com/api/pricing before relying on
// this for real billing decisions — override via env if it changes.
export const WHISPER_COST_PER_MINUTE = Number(process.env.WHISPER_COST_PER_MINUTE ?? 0.006);

export function estimateTranscriptionCostUsd(durationSeconds: number): number {
  return (durationSeconds / 60) * WHISPER_COST_PER_MINUTE;
}

export type TranscriptSegment = { start: number; end: number; text: string };

type WhisperVerboseResponse = {
  text: string;
  segments?: { start: number; end: number; text: string }[];
};

// Transcribes one chunk and shifts its segment timestamps by the chunk's offset in the
// original audio, so segments from every chunk line up on one shared timeline.
export async function transcribeChunk(chunkPath: string, offsetSeconds: number): Promise<TranscriptSegment[]> {
  const openai = getClient();
  const response = (await openai.audio.transcriptions.create({
    file: fs.createReadStream(chunkPath),
    model: "whisper-1",
    response_format: "verbose_json",
  })) as unknown as WhisperVerboseResponse;

  if (!response.segments?.length) {
    return response.text.trim() ? [{ start: offsetSeconds, end: offsetSeconds, text: response.text.trim() }] : [];
  }

  return response.segments.map((s) => ({
    start: s.start + offsetSeconds,
    end: s.end + offsetSeconds,
    text: s.text.trim(),
  }));
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Renders the stitched transcript with periodic timestamp markers (every ~30s) so Annie's
// analysis can reference "around 4:30" the way a human reviewer would, and so the pacing
// estimate below has a visible basis.
export function formatTranscript(segments: TranscriptSegment[]): string {
  const lines: string[] = [];
  let lastMarker = -30;
  for (const seg of segments) {
    if (seg.start - lastMarker >= 30) {
      lines.push(`\n[${formatTimestamp(seg.start)}]`);
      lastMarker = seg.start;
    }
    lines.push(seg.text);
  }
  return lines.join(" ").trim();
}

export function estimateSpeakingPaceWpm(segments: TranscriptSegment[]): number | null {
  if (segments.length === 0) return null;
  const totalWords = segments.reduce((sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length, 0);
  const durationMinutes = (segments[segments.length - 1].end - segments[0].start) / 60;
  if (durationMinutes <= 0) return null;
  return Math.round(totalWords / durationMinutes);
}
