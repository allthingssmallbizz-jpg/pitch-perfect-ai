import type { Project } from "@/types/database";
import { formatDiscoveryBlock } from "./shared";

export const AD_IMAGE_CREDIT_COST = 2;
export const AD_IMAGE_MAX_OUTPUT_TOKENS = 400;

export type ImageAdCopy = { headline: string; subheadline: string; cta: string };

// Deliberately NOT the long-form multi-angle ad_copy prompt (buildAdCopyPrompt) — this needs
// exactly three short strings that will be rendered as text overlaid on a photo client-side
// (see AdImageClient.tsx's canvas compositing), so length limits are hard constraints, not
// style guidance.
export function buildAdImageCopyPrompt(project: Project): string {
  return `Write copy for a single-image paid social ad (Facebook/Instagram feed, square format) that will be overlaid directly on a photo — not a full ad campaign, just the three short pieces of text that fit on the image itself.

${formatDiscoveryBlock(project)}

Respond with ONLY JSON — no prose before or after, no markdown code fence — matching this exact shape:
{"headline": "...", "subheadline": "...", "cta": "..."}

Hard constraints (text that's too long won't fit on the image):
- "headline": max 6 words / 45 characters. The single scroll-stopping line — specific, not generic ("How I Signed 12 Clients in 30 Days" beats "Grow Your Business").
- "subheadline": max 12 words / 90 characters. One supporting line — the mechanism, the promise, or the proof.
- "cta": max 3 words. Button text only, e.g. "Book a Call", "Shop Now", "Get Started".

Ground any claim in the project's "Proof" field; if no proof is available, don't invent a number — write something benefit-driven instead.`;
}

// Claude is instructed to return raw JSON, but strips a code fence defensively in case it
// adds one anyway (same defensive parse as headlineLab.ts's parseRatedHeadlines).
export function parseImageAdCopy(content: string): ImageAdCopy {
  const cleaned = content.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed: unknown = JSON.parse(cleaned);

  if (typeof parsed !== "object" || parsed === null) throw new Error("Malformed response");
  const record = parsed as Record<string, unknown>;
  if (
    typeof record.headline !== "string" ||
    typeof record.subheadline !== "string" ||
    typeof record.cta !== "string"
  ) {
    throw new Error("Malformed response");
  }

  return { headline: record.headline, subheadline: record.subheadline, cta: record.cta };
}
