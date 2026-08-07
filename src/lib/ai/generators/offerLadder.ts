import type { Project } from "@/types/database";
import { formatDiscoveryBlock } from "./shared";

export const OFFER_LADDER_CREDIT_COST = 4;
export const OFFER_LADDER_MAX_OUTPUT_TOKENS = 3500;

export function buildOfferLadderPrompt(project: Project): string {
  return `Design a full offer ladder / customer ascension journey for the project below, per the Offer Creation Operating Manual's Customer Value Equation and pricing sequence (transformation → value → proof → implementation → investment).

${formatDiscoveryBlock(project)}

Produce four tiers, each with a name, one-line promise, core deliverable, suggested price point, and why it earns its place in the ladder:
1. **Lead magnet** (free) — the smallest possible win that proves the mechanism works and starts the relationship.
2. **Low-ticket** — a fast, focused offer that solves one narrow slice of the problem and builds trust for the bigger offer.
3. **Mid-ticket** (this should map to the project's actual price/offer if one was supplied) — the core transformation.
4. **High-ticket** — a premium, higher-touch version (coaching/done-with-you/done-for-you) for customers who want more support or speed.

For each tier also give: 2-3 headline options, and the single biggest objection that tier needs to overcome. Then add a short **Honest Assessment** section: flag any tier that seems weak, redundant, or poorly differentiated from its neighbors given what's actually known about this offer — don't just validate every tier because it fits the template.`;
}
