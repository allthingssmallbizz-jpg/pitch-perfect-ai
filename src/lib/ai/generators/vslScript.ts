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

Stage 5 (Credibility Bridge) and Stage 6 (Opening Story) specifically should be built from the Presenter Bio fields, not invented: Stage 5 from years in the industry / credentials / mission; Stage 6 from the presenter's actual origin story or setback story (a real "here's what I went through" beat is what this stage is for — use whichever of the two fits the arc better). If neither Presenter Bio field was supplied, flag both stages as a gap needing real input rather than fabricating a story.`;
}
