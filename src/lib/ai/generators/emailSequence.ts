import type { Project } from "@/types/database";
import { formatDiscoveryBlock } from "./shared";

export const EMAIL_SEQUENCE_CREDIT_COST = 2;
export const EMAIL_SEQUENCE_MAX_OUTPUT_TOKENS = 4000;

export function buildEmailSequencePrompt(project: Project): string {
  return `Write a launch email sequence for the project below, following the PPOS™ belief-shift arc across the sequence rather than repeating the same pitch every email.

${formatDiscoveryBlock(project)}

Write 7 emails covering this arc:
1. **Indoctrination** — welcome + set expectations + the Big Promise
2. **Relevance** — mirror their situation, one shared-experience story
3. **Belief shift** — surface the false belief, introduce the new belief/mechanism
4. **Proof** — case study or testimonial (only from supplied "Proof"; flag gap otherwise)
5. **Objection handling** — address the biggest implied objection directly
6. **Offer / value stack** — the offer, bonuses, guarantee
7. **Urgency / last call** — authentic urgency only if a real deadline/scarcity mechanism was supplied; otherwise close on risk reversal instead of manufactured urgency

For each email output: **Subject line**, **Preview text**, and full body copy. Keep each email focused on ONE job — don't cram the whole pitch into every email.`;
}
