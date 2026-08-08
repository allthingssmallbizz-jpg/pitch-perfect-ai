// Read Aloud (TTS) — narrates already-generated content using OpenAI's TTS API. This app
// already has OPENAI_API_KEY configured for Agent Annie's video transcription (see
// src/lib/video/transcription.ts), so this reuses the same credential rather than needing a
// separate provider.
export const TTS_CREDIT_COST = 1;

// OpenAI's tts-1 accepts up to ~4096 input characters per request — the client chunks longer
// text well under this (see src/components/TtsPlayer.tsx) so a single request never gets close.
export const TTS_MAX_CHARS = 4000;

// $ per million characters for the tts-1 model. Verify against
// https://openai.com/api/pricing before relying on this for real billing decisions.
export const TTS_COST_PER_MILLION_CHARS = Number(process.env.TTS_COST_PER_MILLION_CHARS ?? 15);

export function estimateTtsCostUsd(charCount: number): number {
  return (charCount / 1_000_000) * TTS_COST_PER_MILLION_CHARS;
}

export const TTS_VOICES = [
  { id: "alloy", label: "Alloy — neutral" },
  { id: "echo", label: "Echo — deep male" },
  { id: "fable", label: "Fable — warm British" },
  { id: "onyx", label: "Onyx — authoritative" },
  { id: "nova", label: "Nova — bright female" },
  { id: "shimmer", label: "Shimmer — soft female" },
] as const;

export type TtsVoice = (typeof TTS_VOICES)[number]["id"];
export const TTS_VOICE_IDS = TTS_VOICES.map((v) => v.id) as [TtsVoice, ...TtsVoice[]];
