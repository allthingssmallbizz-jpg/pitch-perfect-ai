// Video-specific companion to analyzer.ts for Agent Annie's video upload path. Builds the
// user prompt from a transcribed/framed video instead of pasted text, and pairs it with the
// same verbatim ANALYZER_SYSTEM_PROMPT + Annie persona — no duplication of the rubric itself.
import type { PresentationType } from "@/types/database";
import {
  PRESENTATION_TYPE_LABELS,
  PRESENTATION_TYPE_FRAMEWORK_CHECKS,
  DEFAULT_FRAMEWORK_CHECK,
} from "@/lib/ai/analyzer";

// Higher than ANALYZER_CREDIT_COST (8) — a video run also pays for Whisper transcription,
// frame extraction, and a much larger input (full transcript + several images).
export const VIDEO_ANALYZER_CREDIT_COST = 20;

// 90 minutes covers a full webinar/VSL replay, per explicit product requirement: short-clip-only
// (the original ≤5 min default) would not serve real webinar-length client content.
export const VIDEO_MAX_DURATION_SECONDS = 90 * 60;

// Must not exceed the "presentation-videos" Storage bucket's file_size_limit
// (supabase/migrations/0004_video_analysis.sql).
export const VIDEO_MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

// Length of each audio segment sent to Whisper — comfortably under its per-request limits
// even for talkative chunks, while keeping the number of parallel transcription calls small
// for a 90-minute video (at most 6 chunks).
export const VIDEO_CHUNK_SECONDS = 15 * 60;

// Sample frames sent to Claude's vision input for visual review (slide legibility, presenter
// framing/lighting). Spread evenly across the video — enough to catch drift over 90 minutes
// without ballooning the request.
export const VIDEO_MAX_FRAMES = 8;

// A long transcript needs more room to quote/reference than the paste-text path.
export const VIDEO_ANALYZER_MAX_OUTPUT_TOKENS = 8000;

export function computeFrameTimestamps(durationSeconds: number, maxFrames: number = VIDEO_MAX_FRAMES): number[] {
  const count = Math.max(1, Math.min(maxFrames, Math.floor(durationSeconds / 30) || 1));
  const timestamps: number[] = [];
  for (let i = 0; i < count; i++) {
    // Evenly spaced, inset from the very start/end where there's often blank/dead time.
    const fraction = (i + 1) / (count + 1);
    timestamps.push(Math.round(durationSeconds * fraction));
  }
  return timestamps;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

// The system prompt assumes it may receive video/audio — here it actually does (a transcript
// plus sampled frames), so, unlike the text-paste path, Section 13 (Delivery Analysis) and the
// visual/audio parts of Sections 9 and 14 should be evaluated normally rather than skipped.
export function buildVideoAnalyzerUserPrompt(
  presentationType: PresentationType,
  transcript: string,
  durationSeconds: number,
  speakingPaceWpm: number | null,
  frameCount: number
): string {
  const typeSpecificNotes = PRESENTATION_TYPE_FRAMEWORK_CHECKS[presentationType] ?? DEFAULT_FRAMEWORK_CHECK;
  return `Presentation type: ${PRESENTATION_TYPE_LABELS[presentationType]}
Submission format: uploaded video (${formatDuration(durationSeconds)}). You are given the full spoken transcript (with timestamp markers) and ${frameCount} still frames sampled evenly across the runtime.
${typeSpecificNotes}
${speakingPaceWpm ? `Estimated average speaking pace: ~${speakingPaceWpm} words per minute (computed from transcript timing — treat as an approximation, not a precise measurement).` : ""}

Use the transcript for content, structure, and pacing analysis, and the sampled frames for visual/delivery signal (slide legibility, presenter framing, lighting, on-screen text, branding). The frames are still images, not continuous video — do not claim to assess things only visible in motion (e.g. specific gestures, continuous eye contact) from them; note plainly where a criterion needs full video/audio review beyond what stills and a transcript can show.

TRANSCRIPT (with timestamp markers):
"""
${transcript}
"""`;
}
