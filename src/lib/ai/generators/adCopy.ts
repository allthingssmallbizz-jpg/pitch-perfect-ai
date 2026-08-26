import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";

export const AD_COPY_CREDIT_COST = 3;
export const AD_COPY_MAX_OUTPUT_TOKENS = 3000;

export function buildAdCopyPrompt(project: Project, priorGenerations: PriorGeneration[] = []): string {
  return `Write paid ad copy for the project below — Facebook/Instagram feed ads and a YouTube pre-roll script. Ads work on scroll-stopping specificity, not the full PPOS arc, so keep every angle tight.

${formatDiscoveryBlock(project)}
${formatPriorGenerationsBlock(priorGenerations)}

Produce:
1. **5 Facebook/Instagram ad variations**, each with: a scroll-stopping hook (first line), 2-4 sentences of body copy building one angle (pick a different angle per variation — curiosity, pain/agitation, proof/results, contrarian, direct offer), and a specific CTA button text (e.g. "Learn More", "Get Started").
2. **3 headline options per variation** (Facebook allows testing multiple headlines against one body).
3. **1 YouTube pre-roll script** (15-30 seconds spoken): hook in the first 5 seconds (this is skippable — earn the next 5 seconds), then problem → solution → one clear CTA.

Ground every claim/result in the project's "Proof" field; where no proof was supplied, write "[NEEDS PROOF]" instead of inventing a number or testimonial. Keep copy platform-appropriate — short, punchy, no long-form persuasion.`;
}
