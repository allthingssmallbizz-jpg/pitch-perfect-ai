import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";
import { parsePptOutline } from "../pptxParser";
import { PPT_OUTLINE_MIN_ACCEPTABLE_SLIDES } from "./pptOutline";

// "Create Script" — the natural next question after Your Webinar (the slide deck) exists:
// "okay, so what do I actually SAY on each slide?" Your Webinar's own speaker notes are
// deliberately short (1-3 concise sentences, meant for a Notes-pane glance) — this is a separate,
// fuller talk-track a presenter can read or rehearse from on its own, aligned 1:1 to the exact
// deck that already exists rather than re-deriving its own structure from discovery. Reuses
// Agent Polly (see agents/config.ts) rather than inventing a new agent identity — writing the
// script for the deck she just built is the same job continued, not a different specialty.
export const WEBINAR_SCRIPT_CREDIT_COST = 10;
// Matches PPT_OUTLINE_MAX_OUTPUT_TOKENS — same 60-90 item count to cover, and natural spoken
// script per slide runs denser than a deck's own short bullets/notes, so this needs at least as
// much headroom, not less.
export const WEBINAR_SCRIPT_MAX_OUTPUT_TOKENS = 16000;

// Every project's deck ranges 60-90 slides by its own prompt's requirement (see
// PPT_OUTLINE_MIN_ACCEPTABLE_SLIDES's comment for the real failure this threshold catches:
// Claude stopping on its own well short of the full count without hitting a token cutoff, so
// generateCompleteAsset's normal max_tokens-only continuation trigger never fires). Reusing the
// same fixed threshold here — rather than dynamically matching this specific project's actual
// slide count — trades a little precision for not having to thread the source deck's exact count
// through the generic AssetGenerator.isOutputIncomplete signature; PPT Outline decks essentially
// never actually fall below it now that its own generation is enforced the same way.
export function isWebinarScriptIncomplete(content: string): boolean {
  return parsePptOutline(content).length < PPT_OUTLINE_MIN_ACCEPTABLE_SLIDES;
}

export const WEBINAR_SCRIPT_CONTINUATION_HINT =
  "You stopped before writing a script for every slide in the deck — this is not done yet. Keep going in the exact same slide order, one script section per remaining slide, copying each slide's number and title exactly as they appear in the deck provided.";

export function buildWebinarScriptPrompt(project: Project, priorGenerations: PriorGeneration[] = []): string {
  const deck = priorGenerations.find((p) => p.assetType === "ppt_outline");
  // Deliberately NOT run through formatPriorGenerationsBlock's PRIOR_GENERATION_CHAR_LIMIT
  // truncation (shared.ts caps prior-asset context to ~4000 characters, fine for "stay
  // consistent with the headline" but would silently cut the deck off after its first dozen
  // slides here, wrecking exactly the 1:1 alignment this whole generator exists for). The route
  // guards against calling this at all when `deck` is missing — see /api/generate/route.ts.
  const deckContent = deck?.content ?? "";
  const otherContext = formatPriorGenerationsBlock(priorGenerations.filter((p) => p.assetType !== "ppt_outline"));

  return `Write the full spoken script — what the presenter actually says out loud — for the exact slide deck below, one script section per slide, aligned 1:1 to that deck's own numbering and titles. Do not invent a different slide structure, skip slides, or renumber anything.

${formatDiscoveryBlock(project)}
${otherContext}

THE EXACT SLIDE DECK TO WRITE A SCRIPT FOR — copy every slide's number and title exactly as they appear here, in the same order, with no slides skipped:
${deckContent}

For each slide, output:
**Slide #: Title** (copied exactly from the deck above)
2-5 sentences of natural, conversational spoken script — not a word-for-word essay to be read flatly, and not just a restatement of the slide's bullets. This is what the presenter actually SAYS while that slide is on screen: expand the point, bridge from what was just said, build belief, and set up what's coming next. It should sound like a real person talking to a room, not a document being narrated.

Keep the pacing natural for the format (a 60-90 slide deck runs roughly 60-90 minutes, so most slides get a tight few sentences, not a monologue) but substantial enough that someone with zero prep could read straight through it and deliver an effective, persuasive, on-message presentation — hit the emotional beats (curiosity, belief-shift, credibility, urgency, the ask) each slide exists for rather than just describing what's visible on it.`;
}
