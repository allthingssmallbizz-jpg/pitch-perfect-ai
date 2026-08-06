import type { Project } from "@/types/database";
import { getKnowledgeFile } from "@/lib/ai/systemPrompt";
import { formatDiscoveryBlock } from "./shared";

export const VSL_CREDIT_COST = 5;
export const VSL_MAX_OUTPUT_TOKENS = 5000;

export function buildVslScriptPrompt(project: Project): string {
  const structure = getKnowledgeFile("05-vsl-25-part.md");

  return `Write a full VSL (Video Sales Letter) script using the 25-part structure below for the project.

${formatDiscoveryBlock(project)}

25-PART STRUCTURE TO FOLLOW:
${structure}

Write full spoken-word script copy for each of the 25 beats (label each beat with its number and name), not just bullet notes — this should be close to word-for-word what the presenter says on camera or in voiceover. Keep beats tight (2-5 sentences each) so the full script stays watchable. Ground every proof/results claim in the project's "Proof" field; where no proof was supplied, write "[NEEDS PROOF: <what kind>]" instead of inventing a number or testimonial.`;
}
