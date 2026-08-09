import type { Project } from "@/types/database";
import { formatDiscoveryBlock } from "./shared";

// Raised from 3 — the 60-90 slide requirement below roughly doubled real output-token spend
// per generation (see PPT_OUTLINE_MAX_OUTPUT_TOKENS), so the credit price members pay was
// bumped to match and keep this in line with the margin math.
export const PPT_OUTLINE_CREDIT_COST = 10;
// Raised from 3500 — a full 60-90 slide deck needs roughly that many slides' worth of titles,
// bullets, and speaker notes, which doesn't fit in the old cap at all (it was silently
// truncating output to something like 15-25 slides, far short of a real webinar deck). 8000 is
// the safe ceiling for a standard (non-extended-output) Claude API call.
export const PPT_OUTLINE_MAX_OUTPUT_TOKENS = 8000;

export function buildPptOutlinePrompt(project: Project): string {
  return `Build a slide-by-slide PowerPoint outline (titles + speaker notes, not full design) for presenting this offer. Use PPWOS™ phases if this reads as a consumer webinar/pitch, or PPSOS™ (Capture Executive Attention → Build Business Relevance → Create New Business Beliefs → Build Executive Certainty → Present the Solution → Maximize Business Value → Drive Organizational Commitment) if the discovery notes indicate a B2B/enterprise/multi-stakeholder audience.

${formatDiscoveryBlock(project)}

For each slide output:
- **Slide #: Title**
- **On-slide content** (short — headline + up to 3 bullets, this is a deck not a document)
- **Speaker notes** (what the presenter actually says, 1-3 concise sentences)

This needs to be a full-length, effective webinar deck, not a summary outline: produce **60-90 slides** (err toward 75+ when the discovery brief supports it). Break every phase of the arc — opener/hook, credibility, each teaching point, transition, offer stack, guarantee, urgency, close/CTA — into real slide-by-slide pacing instead of compressing a phase into one or two slides. Keep each individual slide's content tight and non-repetitive (short bullets, concise notes) so the full count stays readable rather than bloated — the length comes from thorough pacing across the whole arc, not from padding any single slide.`;
}
