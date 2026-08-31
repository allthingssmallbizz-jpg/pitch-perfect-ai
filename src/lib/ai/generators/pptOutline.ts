import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";
import { parsePptOutline } from "../pptxParser";

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

// A real generation came back with only 7-8 slides instead of the required 60-90 — Claude had
// stopped on its own (stop_reason "end_turn", not "max_tokens"), having compressed each phase of
// the arc into a single slide despite the prompt explicitly warning against exactly that. Since
// that's not a hard token cutoff, generateCompleteAsset's original continuation trigger
// (stop_reason === "max_tokens") never fired and the short result was saved as if it were
// complete. This threshold — well under the 60 floor, not right up against it — is what
// generateCompleteAsset checks instead: below it, force a continuation even on a natural stop;
// at or above it, trust Claude finished a real deck rather than chase the exact upper bound of a
// range that was always meant to flex with how much the discovery brief actually supports.
export const PPT_OUTLINE_MIN_ACCEPTABLE_SLIDES = 50;

export function isPptOutlineIncomplete(content: string): boolean {
  return parsePptOutline(content).length < PPT_OUTLINE_MIN_ACCEPTABLE_SLIDES;
}

export const PPT_OUTLINE_CONTINUATION_HINT =
  "You stopped short of the required 60-90 total slides — this deck is not done yet. Keep writing through the rest of the arc (remaining teaching points, transition, offer stack, guarantee, urgency, close/CTA) with the same slide-by-slide pacing as before: one slide per real beat, not one slide per phase.";

export function buildPptOutlinePrompt(project: Project, priorGenerations: PriorGeneration[] = []): string {
  return `Build a slide-by-slide PowerPoint outline (titles + speaker notes, not full design) for presenting this offer. Use PPWOS™ phases if this reads as a consumer webinar/pitch, or PPSOS™ (Capture Executive Attention → Build Business Relevance → Create New Business Beliefs → Build Executive Certainty → Present the Solution → Maximize Business Value → Drive Organizational Commitment) if the discovery notes indicate a B2B/enterprise/multi-stakeholder audience.

${formatDiscoveryBlock(project)}
${formatPriorGenerationsBlock(priorGenerations)}

If a Webinar Outline already exists above for this project, build these slides directly from its phases and beats (same headline, same belief shift, same offer stack order) rather than re-deriving the arc from discovery alone — this deck should be the visual version of that exact outline, not a different pass at the same facts.

For each slide output:
- **Slide #: Title**
- **On-slide content**: 2-4 bullets, EVERY one a complete, specific, substantive point — a real claim, number, benefit, or insight a viewer could read on its own and understand, not a bare fragment or vague label. "Turn 20 years of industry knowledge into a $10K/month coaching offer" is a real bullet; "Our Solution" or "Knowledge → Income" is not — it forces the audience to guess what you mean instead of landing the point. A new presenter reading only what's on screen (no narration at all) should still walk away understanding the point of that slide. Still a deck, not a document: each bullet is one tight, complete phrase or short sentence — not a paragraph, and never the actual spoken script.
- **Speaker notes**: 1-3 concise sentences — what the presenter actually SAYS out loud while this slide is up. This is for the presenter's eyes only; it must never repeat, duplicate, or expand into the on-slide bullets above, and the on-slide bullets must never be a shortened copy of the speaker notes. Keep the two doing genuinely different jobs: bullets are what the audience reads, notes are what the presenter says — related, but not the same words twice.

This needs to be a full-length, effective webinar deck, not a summary outline: produce **60-90 slides** (err toward 75+ when the discovery brief supports it). Break every phase of the arc — opener/hook, credibility, each teaching point, transition, offer stack, guarantee, urgency, close/CTA — into real slide-by-slide pacing instead of compressing a phase into one or two slides. A slide with only one bare bullet, or a bullet that's just a topic label, is a failure to fix — every slide earns its place with real content, not a placeholder. Keep the deck non-repetitive across its full length (each slide's specific claim, not the same point restated) so the length comes from genuinely thorough pacing across the whole arc, not padding.`;
}
