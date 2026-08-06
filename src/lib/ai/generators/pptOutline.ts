import type { Project } from "@/types/database";
import { formatDiscoveryBlock } from "./shared";

export const PPT_OUTLINE_CREDIT_COST = 3;
export const PPT_OUTLINE_MAX_OUTPUT_TOKENS = 3500;

export function buildPptOutlinePrompt(project: Project): string {
  return `Build a slide-by-slide PowerPoint outline (titles + speaker notes, not full design) for presenting this offer. Use PPWOS™ phases if this reads as a consumer webinar/pitch, or PPSOS™ (Capture Executive Attention → Build Business Relevance → Create New Business Beliefs → Build Executive Certainty → Present the Solution → Maximize Business Value → Drive Organizational Commitment) if the discovery notes indicate a B2B/enterprise/multi-stakeholder audience.

${formatDiscoveryBlock(project)}

For each slide output:
- **Slide #: Title**
- **On-slide content** (short — headline + up to 4 bullets, this is a deck not a document)
- **Speaker notes** (what the presenter actually says, 2-4 sentences)

Cover the full arc from opener through close/CTA. Aim for 15-25 slides depending on how much discovery content is available — don't pad with filler slides.`;
}
