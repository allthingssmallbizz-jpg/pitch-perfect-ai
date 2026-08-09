import type { Project } from "@/types/database";
import { formatDiscoveryBlock } from "./shared";

// Raised from 3 — the 60-90 slide requirement below roughly doubled real output-token spend
// per generation (see PPT_OUTLINE_MAX_OUTPUT_TOKENS), so the credit price members pay was
// bumped to match and keep this in line with the margin math.
export const PPT_OUTLINE_CREDIT_COST = 10;
// Raised from 3500, then from 8000 — a real test run at 8000 tokens still cut off mid-slide
// around slide 40 of the required 60-90 (roughly 200 tokens/slide in practice, so 90 slides
// needs ~18,000). 16000 gives headroom for the great majority of decks in one shot; if a
// generation is still cut off beyond that, generateCompleteAsset (src/lib/ai/anthropic.ts)
// automatically continues rather than silently truncating.
export const PPT_OUTLINE_MAX_OUTPUT_TOKENS = 16000;

export function buildPptOutlinePrompt(project: Project): string {
  return `Build a slide-by-slide PowerPoint outline (titles + speaker notes, not full design) for presenting this offer. Use PPWOS™ phases if this reads as a consumer webinar/pitch, or PPSOS™ (Capture Executive Attention → Build Business Relevance → Create New Business Beliefs → Build Executive Certainty → Present the Solution → Maximize Business Value → Drive Organizational Commitment) if the discovery notes indicate a B2B/enterprise/multi-stakeholder audience.

${formatDiscoveryBlock(project)}

For each slide output:
- **Slide #: Title**
- **On-slide content** (short — headline + up to 3 bullets, this is a deck not a document)
- **Speaker notes** (what the presenter actually says, 1-3 concise sentences)

This needs to be a full-length, effective webinar deck, not a summary outline: produce **60-90 slides** (err toward 75+ when the discovery brief supports it). Break every phase of the arc — opener/hook, credibility, each teaching point, transition, offer stack, guarantee, urgency, close/CTA — into real slide-by-slide pacing instead of compressing a phase into one or two slides. Keep each individual slide's content tight and non-repetitive (short bullets, concise notes) so the full count stays readable rather than bloated — the length comes from thorough pacing across the whole arc, not from padding any single slide.`;
}
