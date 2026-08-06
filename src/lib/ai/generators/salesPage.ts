import type { Project } from "@/types/database";
import { formatDiscoveryBlock } from "./shared";

export const SALES_PAGE_CREDIT_COST = 4;
export const SALES_PAGE_MAX_OUTPUT_TOKENS = 4500;

export function buildSalesPagePrompt(project: Project): string {
  return `Write a complete long-form sales page using PPOS™ (Capture Attention → Build Relevance → Create New Beliefs → Build Certainty → Present the Solution → Maximize Value → Drive Commitment) for the project below.

${formatDiscoveryBlock(project)}

Output real, publish-ready copy organized under these section headers:
1. **Headline + Subheadline** (the Big Promise — outcome-led)
2. **Opening / Relevance** (name the audience, mirror their situation)
3. **The Belief Shift** (surface the ONE false belief, introduce the new belief/mechanism, name it if there's a proprietary method)
4. **Proof** (case studies / testimonials / results — only from the supplied "Proof" field; mark gaps as [NEEDS PROOF])
5. **The Offer** (what it is, how it works, the transformation — not just features)
6. **Value Stack** (core offer + each bonus mapped to the objection it kills + total value framing before price)
7. **Guarantee / Risk Reversal**
8. **FAQ / Objections** (anticipate 4-6 objections implied by the discovery notes and answer each)
9. **Final CTA** (one clear, specific, repeated call to action)

Write full page copy, not an outline — this is meant to be pasted directly into a page builder.`;
}
