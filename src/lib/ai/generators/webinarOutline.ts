import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";

export const WEBINAR_CREDIT_COST = 3;
export const WEBINAR_MAX_OUTPUT_TOKENS = 4000;

export function buildWebinarOutlinePrompt(project: Project, priorGenerations: PriorGeneration[] = []): string {
  return `Build a full Webinar Outline using the Pitch Perfect Webinar Operating System™ (PPWOS™) for the project below.

${formatDiscoveryBlock(project)}
${formatPriorGenerationsBlock(priorGenerations)}

Produce the outline in this structure:
1. **Phase 1 — Capture Attention**: Welcome beat, Big Promise (the outcome, not the topic), agenda, opening engagement trigger (poll/chat question).
2. **Phase 2 — Build Relevance**: Audience identification bullets, opportunity framing, one shared-experience story beat, an interactive reflection question.
3. **Phase 3 — Create New Beliefs**: State the ONE central belief being shifted. List 3-5 strategic teaching beats that support it. Include one "false belief removal" line ("Many people naturally assume... but..."). Name a framework if relevant. Add 1-2 micro-commitment check-in lines.
4. **Phase 4 — Build Certainty**: List the proof elements to use (case study, testimonial, demonstration) — pull from the project's "Proof" field; if none was supplied, flag it as a gap to fill rather than inventing one.
5. **Phase 5 — Present the Solution**: One paragraph introducing the offer as the natural next step, plus a future-pacing beat (30/90/365 days).
6. **Phase 6 — Maximize Value**: Core offer summary, bonus stack (map each bonus to the objection it removes), investment framing, guarantee.
7. **Phase 7 — Drive Commitment**: Scarcity/urgency (only if authentic — otherwise note "no authentic urgency mechanism supplied"), risk removal, and the single specific CTA repeated 2-3 times through this section.

Keep each phase to a one-screen block: a one-line strategic objective followed by bullet beats — not full prose script. This is a skeleton a presenter builds slides and talk track from, not a word-for-word script.`;
}
