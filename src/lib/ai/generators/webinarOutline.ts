import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";

export const WEBINAR_CREDIT_COST = 3;
export const WEBINAR_MAX_OUTPUT_TOKENS = 4000;

export function buildWebinarOutlinePrompt(project: Project, priorGenerations: PriorGeneration[] = []): string {
  return `Build a full Webinar Outline using the Pitch Perfect Webinar Operating System™ (PPWOS™) for the project below.

${formatDiscoveryBlock(project)}
${formatPriorGenerationsBlock(priorGenerations)}

Produce the outline in this structure:
1. **Phase 1 — Capture Attention**: Welcome beat, Big Promise (the outcome, not the topic), agenda, opening engagement trigger (poll/chat question), then a short **Presenter Credibility Bridge** beat — who's presenting and why they're qualified to, built from the Presenter Bio fields (years in the industry, credentials, mission). Keep it tight (3-5 lines): earn the right to teach, don't deliver a full bio speech.
2. **Phase 2 — Build Relevance**: Audience identification bullets, opportunity framing, one shared-experience story beat built as a full Epiphany Bridge™ story (Playbook 10) from the real Presenter Bio fields supplied — Backstory (origin story) → Desire → Wall (setback story) → Mentor → Epiphany (the exact "moment everything changed" field — the belief being planted, stated as a discovery) → Plan → Conflict → Achievement (signature win) → Return ("that's exactly why I'm here today"). A real "I've been where you are" moment lands harder than an invented one — if the epiphany field specifically is blank, don't invent a fake realization; write the turning point only as concretely as the setback story supports. Close Phase 2 with an interactive reflection question.
3. **Phase 3 — Create New Beliefs**: Name the ONE central belief being shifted as the Big Domino™ (Playbook 10) — the belief that, once adopted, makes every other objection collapse on its own. List 3-5 strategic teaching beats that support it. Include one "false belief removal" line ("Many people naturally assume... but..."). Name a framework if relevant. Add 1-2 micro-commitment check-in lines. Remember: the presenter is the Guide here, not the Hero (Playbook 10) — from this phase forward, keep the focus on the AUDIENCE's own journey toward the belief shift, not back on the presenter's story.
4. **Phase 4 — Build Certainty**: List the proof elements to use (case study, testimonial, demonstration) — pull from the project's "Proof" field and the Presenter Bio's "Greatest client transformation" story if one was supplied; if neither exists, flag it as a gap to fill rather than inventing one.
5. **Phase 5 — Present the Solution**: One paragraph introducing the offer as the natural next step, plus a future-pacing beat (30/90/365 days).
6. **Phase 6 — Maximize Value**: Core offer summary, bonus stack (map each bonus to the objection it removes), investment framing, guarantee.
7. **Phase 7 — Drive Commitment**: Scarcity/urgency (only if authentic — otherwise note "no authentic urgency mechanism supplied"), risk removal, and the single specific CTA repeated 2-3 times through this section.

Keep each phase to a one-screen block: a one-line strategic objective followed by bullet beats — not full prose script. This is a skeleton a presenter builds slides and talk track from, not a word-for-word script.`;
}
