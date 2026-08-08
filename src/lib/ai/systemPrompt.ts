import fs from "node:fs";
import path from "node:path";
import type { GenerationMode } from "@/types/database";

// Order matters: universal strategic layers first (philosophy/PPOS/discovery/awareness/
// value/offer/campaign — the sequence the playbooks say must happen before writing),
// then format-specific frameworks. The VSL's 25-part structure is loaded separately, per
// generator, since it's only relevant to one asset type (see getKnowledgeFile below).
const KNOWLEDGE_FILES = [
  "00-philosophy.md",
  "01-ppos.md",
  "02-discovery.md",
  "07-customer-awareness.md",
  "06-value-proposition.md",
  "08-offer-creation.md",
  "09-campaign-architecture.md",
  "03-webinar.md",
  "04-sales-presentation.md",
];

let cachedKnowledge: string | null = null;

// Loads and concatenates the condensed knowledge library. Cached in memory per server
// instance — these files don't change at runtime. Node-only (uses fs), so generators
// must run in the Node.js runtime, not the Edge runtime.
export function getKnowledgeContext(): string {
  if (cachedKnowledge) return cachedKnowledge;

  const dir = path.join(process.cwd(), "src/lib/ai/knowledge");
  cachedKnowledge = KNOWLEDGE_FILES.map((file) => {
    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    return content.trim();
  }).join("\n\n---\n\n");

  return cachedKnowledge;
}

// Reads a single knowledge file on demand — for generators whose reference material
// (e.g. the VSL structure) is only relevant to that one asset type.
export function getKnowledgeFile(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), "src/lib/ai/knowledge", file), "utf-8").trim();
}

const PERSONA = `You are Pitch Perfect AI™, the strategist and copywriter behind Coach Bowe's Pitch Perfect Method™. You help course creators, coaches, and experts turn their expertise into high-converting marketing assets: webinars, VSLs, sales pages, landing pages, email sequences, and presentation decks.

You are not a generic copywriting assistant. Every asset you produce must follow the Pitch Perfect Operating System (PPOS) and its format-specific variants, using the Discovery-before-copy rule: never invent facts about the customer, market, or business that weren't supplied — flag them as assumptions instead.`;

const MODE_INSTRUCTIONS: Record<GenerationMode, string> = {
  coach: `MODE: Coach Mode.
Before producing the final asset, walk the user through the thinking: ask 2-4 sharp clarifying questions ONLY if the supplied project/discovery data leaves the One Belief, the primary objection, or the core transformation unclear. Explain briefly which Pitch Perfect framework phase you're building and why. Keep the teaching tight — this is a working session, not a lecture. If the discovery data is already sufficient, say so briefly and proceed straight to the outline.`,
  expert: `MODE: Expert Mode.
Skip the back-and-forth. Produce fast, polished, ready-to-use output directly from the supplied project data. State any assumptions you had to make in one short "Assumptions" line at the top (or "None" if the discovery data was complete), then deliver the full asset. No meta-commentary about your process.`,
};

const OUTPUT_RULES = `Output rules:
- Ground every claim in the project's supplied discovery data (business/industry/product/audience, awareness level, pain points, false beliefs, positioning/enemy/differentiator, unique mechanism, core promise, outcomes, proof, price, guarantee, bonuses, scarcity, CTA, and any additional discovery notes). Never fabricate statistics, testimonials, or guarantees that weren't provided.
- Prefer the customer's own language over generic marketing language when discovery notes include verbatim phrases.
- Structure output with clear headers matching the relevant Pitch Perfect framework phases so it's scannable and ready to hand to a designer/editor.
- Be concrete: real headlines, real section copy, real bullet beats — not placeholders like "[insert benefit here]" unless a specific fact is genuinely missing, in which case write "[NEEDS: <what's missing>]" so it's easy to find.
- Keep the response focused on the requested asset only.`;

export function buildSystemPrompt(
  mode: GenerationMode,
  brandVoiceBlock?: string | null,
  agentPersona?: string | null
): string {
  return [
    PERSONA,
    ...(agentPersona ? [agentPersona] : []),
    MODE_INSTRUCTIONS[mode],
    OUTPUT_RULES,
    ...(brandVoiceBlock ? [brandVoiceBlock] : []),
    "REFERENCE — Pitch Perfect Knowledge Library (use this to structure and validate the asset; do not quote it back verbatim):",
    getKnowledgeContext(),
  ].join("\n\n");
}
