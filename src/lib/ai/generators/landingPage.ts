import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";

export const LANDING_PAGE_CREDIT_COST = 3;
export const LANDING_PAGE_MAX_OUTPUT_TOKENS = 2500;

export function buildLandingPagePrompt(project: Project, priorGenerations: PriorGeneration[] = []): string {
  return `Write a short-form landing page (registration/opt-in page, NOT a full sales page) for the project below. This is the page that gets someone to register for the webinar/VSL or opt in — its only job is the one next action, not a full pitch.

${formatDiscoveryBlock(project)}
${formatPriorGenerationsBlock(priorGenerations)}

Output real, publish-ready copy for:
1. **Headline** (the Big Promise, outcome-led, specific — if a webinar/VSL/sales page already exists above for this project, use its exact Big Promise/headline language rather than writing a different one; this page's job is to get people INTO that asset, not to pitch a competing angle)
2. **Subheadline** (who it's for + what they'll walk away with)
3. **3-5 bullet points** (what they'll learn/get — benefit-led, specific, not generic)
4. **Presenter/authority line** (one or two sentences of credibility — only from supplied proof; skip if none supplied)
5. **CTA button copy** + one supporting line under it (time/date placeholder if it's a webinar registration, or "instant access" framing if it's a VSL/download)
6. **Trust line** (privacy/no-spam or a proof point, only if supplied)

Keep total copy short — this page should be readable in under 15 seconds. No pricing, no objection handling, no long-form persuasion; that's the sales page's job.`;
}
