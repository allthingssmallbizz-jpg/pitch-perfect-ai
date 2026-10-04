import type { Project } from "@/types/database";
import { getKnowledgeFile } from "@/lib/ai/systemPrompt";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";

export const VSL_CREDIT_COST = 5;
export const VSL_MAX_OUTPUT_TOKENS = 5000;

export function buildVslScriptPrompt(project: Project, priorGenerations: PriorGeneration[] = []): string {
  const structure = getKnowledgeFile("05-vsl-25-part.md");

  return `Write a full VSL (Video Sales Letter) script using the 25-part structure below for the project.

${formatDiscoveryBlock(project)}
${formatPriorGenerationsBlock(priorGenerations)}

25-PART STRUCTURE TO FOLLOW:
${structure}

Write full spoken-word script copy for each of the 25 beats (label each beat with its number and name), not just bullet notes — this should be close to word-for-word what the presenter says on camera or in voiceover. Keep beats tight (2-5 sentences each) so the full script stays watchable. Ground every proof/results claim in the project's "Proof" field; where no proof was supplied, write "[NEEDS PROOF: <what kind>]" instead of inventing a number or testimonial.

Stage 5 (Credibility Bridge) and Stage 6 (Opening Story) specifically should be built from the Presenter Bio fields, not invented: Stage 5 from years in the industry / credentials / mission; Stage 6 as a full Epiphany Bridge™ story (Playbook 10) built from whichever real fields were supplied — Backstory from the origin story, The Wall from the setback story, The Epiphany from the exact "moment everything changed" field (this IS the belief being planted — state it as a discovery, not a lesson), The Achievement from the signature win, and The Return as the explicit bridge into Stage 7 onward: "that's exactly why I'm here today." Don't invent a fake epiphany if that field is blank but the setback story is supplied — write the turning point only as concretely as the setback story actually supports, and flag [NEEDS: the specific epiphany/insight] rather than fabricating one. If every Presenter Bio story field is blank, flag Stage 6 as a gap needing real input rather than fabricating a story.

Stage 14 (Belief Shifting) must explicitly name the Big Domino™ (Playbook 10) — the ONE belief that, if adopted, makes every other objection in this script collapse on its own — and every other stage's belief work should visibly serve knocking down that same one belief, not several different ones.`;
}
