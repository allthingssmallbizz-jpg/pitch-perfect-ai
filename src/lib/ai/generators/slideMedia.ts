import type { AssetType, Project, SlideChartType } from "@/types/database";

// v1 scope: only Cora's Build Module Slides decks (8-20 slides) support per-slide media —
// Your Signature Webinar's decks (ppt_outline) run 60-90 slides, where an opt-in-per-slide flow
// and real per-image OpenAI cost compound fast. Easy to extend later (just add "ppt_outline"
// here) once this has proven out on the smaller decks. Shared by the API routes and the
// SlidePreview/GenerateClient UI so both gate on the exact same list.
export const SLIDE_MEDIA_ASSET_TYPES: AssetType[] = ["course_module_slides"];

// Illustrative, AI-generated per-slide images for Cora's Build Module Slides deck — a member
// opts in per slide (never automatic for a whole deck) since this is a real, per-image OpenAI
// cost on top of this app's own credits, unlike every other text generator here.
export const SLIDE_IMAGE_CREDIT_COST = 4;
export const SLIDE_IMAGE_MODEL = "gpt-image-1";
export const SLIDE_IMAGE_SIZE = "1024x1024";
// "low" keeps the real per-image OpenAI cost down — plenty of quality for a background/side
// illustration on a teaching slide, not a print-quality asset. Verify current image pricing at
// https://openai.com/api/pricing before treating this as a fixed cost.
export const SLIDE_IMAGE_QUALITY = "low";
// Rough $ estimate per image at the quality/size above, added onto the parent generation's own
// running cost_usd total purely for admin-side cost visibility (see the /slide-media/image
// route) — same "estimate, verify before relying on it for real billing" caveat as TTS's own
// TTS_COST_PER_MILLION_CHARS.
export const SLIDE_IMAGE_COST_USD_ESTIMATE = 0.02;

// AI image models still can't reliably render legible text (see the Ad Image agent's own
// start route comment) — every prompt explicitly forbids it rather than hoping the slide's own
// title/bullets don't accidentally get drawn into the image as garbled text.
export function buildSlideImagePrompt(
  project: Pick<Project, "industry" | "product">,
  slideTitle: string,
  bullets: string[]
): string {
  const context = [project.industry, project.product].filter((v) => v?.trim()).join(" — ");
  const beat = bullets.slice(0, 2).join("; ");
  return `A clean, modern, professional illustration for a course teaching slide${context ? ` about ${context}` : ""}.
Slide topic: "${slideTitle}"${beat ? `. Key idea: ${beat}` : ""}.
Style: minimalist, flat or soft-gradient illustration, confident and aspirational, suitable as a
background/side visual on an educational slide — not a stock photo, not a screenshot, not a meme,
not a diagram with labels.
Absolutely no text, letters, numbers, or words anywhere in the image — illustrate the idea
visually only.`;
}

// Charts are member-entered data (labels + values), not AI-generated — no OpenAI call, no cost,
// so no credit charge either. Rendered as a real, native, editable chart object in the exported
// .pptx via pptxgenjs's own addChart (see pptxDeckBuilder.ts), not a picture of a chart.
export const SLIDE_CHART_TYPES: SlideChartType[] = ["bar", "line", "pie"];
export const SLIDE_CHART_MAX_POINTS = 8;

export function isSlideChartType(value: string): value is SlideChartType {
  return (SLIDE_CHART_TYPES as readonly string[]).includes(value);
}
