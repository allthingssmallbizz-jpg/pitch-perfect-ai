import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";
import { parsePptOutline } from "../pptxParser";
import { PPT_OUTLINE_MIN_ACCEPTABLE_SLIDES } from "./pptOutline";

// "Create Script" — the natural next question after Your Webinar (the slide deck) exists:
// "okay, so what do I actually SAY on each slide?" Your Webinar's own speaker notes are
// deliberately short (1-3 concise sentences, meant for a Notes-pane glance) — this is a separate,
// fuller talk-track a presenter can read or rehearse from on its own, aligned 1:1 to the exact
// deck that already exists rather than re-deriving its own structure from discovery. Written by
// Agent Winnie (see agents/config.ts) — her own agent, so it never reads as a second Agent Polly
// right next to the deck Polly built.
export const WEBINAR_SCRIPT_CREDIT_COST = 10;
// Matches PPT_OUTLINE_MAX_OUTPUT_TOKENS — same 60-90 item count to cover, and natural spoken
// script per slide runs denser than a deck's own short bullets/notes, so this needs at least as
// much headroom, not less. See that constant's own comment for why this was raised from 16000.
export const WEBINAR_SCRIPT_MAX_OUTPUT_TOKENS = 24000;

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

// A full 60-90 slide script written in one request can take longer than the server's 300-second
// limit (see /api/generate's maxDuration) — the function is then cut off mid-write and the
// generation sits "pending" forever. Long decks are instead split into sections of about this many
// slides, written in parallel, and joined in order: same script, a fraction of the wait.
export const WEBINAR_SCRIPT_SLIDES_PER_SECTION = 20;
// ~20 slides at a few spoken sentences each is roughly 2,500-3,500 tokens; this leaves headroom
// while capping how long one section can possibly run.
// Raised from 6000, which the model's own thinking can use up before writing anything (see
// GenerateEffort in anthropic.ts); sections also run at medium effort for the same reason.
export const WEBINAR_SCRIPT_SECTION_MAX_OUTPUT_TOKENS = 24000;
export const WEBINAR_SCRIPT_SECTION_EFFORT = "medium" as const;

export type WebinarScriptRange = {
  // The deck's own slide numbers in this section, in order.
  numbers: number[];
  part: number;
  parts: number;
  count: number;
  first: { number: number; title: string };
  last: { number: number; title: string };
  totalSlides: number;
  isFinal: boolean;
};

// Splits the deck into evenly sized, in-order sections. Returns a single section (= write it all
// in one request, as before) for a short deck.
export function planWebinarScriptSections(deckContent: string): WebinarScriptRange[] {
  return splitSlidesIntoSections(parsePptOutline(deckContent), WEBINAR_SCRIPT_SLIDES_PER_SECTION);
}

// Shared with the Signature Webinar deck, which splits its own slide plan the same way.
export function splitSlidesIntoSections(
  slides: { number: number; title: string }[],
  slidesPerSection: number
): WebinarScriptRange[] {
  const parts = Math.max(1, Math.ceil(slides.length / slidesPerSection));
  if (parts === 1) return [];
  const size = Math.ceil(slides.length / parts);
  const ranges: WebinarScriptRange[] = [];
  for (let i = 0; i < parts; i++) {
    const chunk = slides.slice(i * size, (i + 1) * size);
    if (!chunk.length) continue;
    ranges.push({
      numbers: chunk.map((s) => s.number),
      part: i + 1,
      parts,
      count: chunk.length,
      first: { number: chunk[0].number, title: chunk[0].title },
      last: { number: chunk[chunk.length - 1].number, title: chunk[chunk.length - 1].title },
      totalSlides: slides.length,
      isFinal: i === parts - 1,
    });
  }
  return ranges;
}

export function isWebinarScriptSectionIncomplete(content: string, range: WebinarScriptRange): boolean {
  return countSectionSlides(content, range) < Math.floor(range.count * 0.9);
}

const SCRIPT_SLIDE_LABEL = /^#{0,4}\s*\*{0,2}\s*slide\s+(\d+)\b/i;

function splitScriptBlocks(content: string): { number: number; text: string }[] {
  const blocks: { number: number; lines: string[] }[] = [];
  for (const line of content.split("\n")) {
    const label = line.match(SCRIPT_SLIDE_LABEL);
    if (label) blocks.push({ number: Number(label[1]), lines: [line] });
    else if (blocks.length) blocks[blocks.length - 1].lines.push(line);
    // Anything before the first slide label (a stray preamble) is dropped.
  }
  return blocks.map((b) => ({ number: b.number, text: b.lines.join("\n").trim() }));
}

function countSectionSlides(content: string, range: WebinarScriptRange): number {
  const wanted = new Set(range.numbers);
  return new Set(splitScriptBlocks(content).map((b) => b.number).filter((n) => wanted.has(n))).size;
}

// Keeps only this section's own slides (first copy of each), so a section that strays past its
// range — or repeats itself in a continuation — can never duplicate slides in the joined script.
export function trimScriptToSection(content: string, range: WebinarScriptRange): string {
  const wanted = new Set(range.numbers);
  const seen = new Set<number>();
  const kept: string[] = [];
  for (const block of splitScriptBlocks(content)) {
    if (!wanted.has(block.number) || seen.has(block.number)) continue;
    seen.add(block.number);
    kept.push(block.text);
  }
  return kept.join("\n\n");
}

export function webinarScriptSectionContinuationHint(range: WebinarScriptRange): string {
  return `You stopped before finishing this section — keep going in the exact same slide order, one script section per remaining slide, up to and including Slide ${range.last.number}: ${range.last.title}. Do not write past that slide.`;
}

export const WEBINAR_SCRIPT_CONTINUATION_HINT =
  "You stopped before writing a script for every slide in the deck — this is not done yet. Keep going in the exact same slide order, one script section per remaining slide, copying each slide's number and title exactly as they appear in the deck provided.";

// sourceDeckContent: the EXACT ppt_outline generation to write a script for, resolved explicitly
// by route.ts (via sourceGenerationId, when a member is viewing a specific past deck version —
// see 0043_webinar_script_source.sql) rather than implicitly "whichever ppt_outline is most
// recent for this project." Falls back to the old priorGenerations lookup when not given, so a
// plain "Create Script" click with no specific deck in view still works exactly as before.
export function buildWebinarScriptPrompt(
  project: Project,
  priorGenerations: PriorGeneration[] = [],
  sourceDeckContent?: string,
  range?: WebinarScriptRange
): string {
  // Deliberately NOT run through formatPriorGenerationsBlock's PRIOR_GENERATION_CHAR_LIMIT
  // truncation (shared.ts caps prior-asset context to ~4000 characters, fine for "stay
  // consistent with the headline" but would silently cut the deck off after its first dozen
  // slides here, wrecking exactly the 1:1 alignment this whole generator exists for). The route
  // guards against calling this at all when no deck content is available — see
  // /api/generate/route.ts.
  const deckContent = sourceDeckContent ?? priorGenerations.find((p) => p.assetType === "ppt_outline")?.content ?? "";
  const otherContext = formatPriorGenerationsBlock(priorGenerations.filter((p) => p.assetType !== "ppt_outline"));

  const opening = range
    ? `Write the spoken script — what the presenter actually says out loud — for ONLY slides ${range.first.number} through ${range.last.number} (part ${range.part} of ${range.parts}) of the exact slide deck below: ${range.count} slides, one script section per slide, aligned 1:1 to that deck's own numbering and titles. Write nothing for any slide outside that range — the rest of the script is being written separately. Do not invent a different slide structure, skip slides, or renumber anything.`
    : "Write the full spoken script — what the presenter actually says out loud — for the exact slide deck below, one script section per slide, aligned 1:1 to that deck's own numbering and titles. Do not invent a different slide structure, skip slides, or renumber anything.";

  return `${opening}

${formatDiscoveryBlock(project)}
${otherContext}

${range ? `THE FULL SLIDE DECK, for context — write the script ONLY for slides ${range.first.number}-${range.last.number}, copying each of those slides' number and title exactly as they appear here, in the same order, with none of them skipped:` : "THE EXACT SLIDE DECK TO WRITE A SCRIPT FOR — copy every slide's number and title exactly as they appear here, in the same order, with no slides skipped:"}
${deckContent}

For each slide, output:
**Slide #: Title** (copied exactly from the deck above, on its own line)
2-5 sentences of natural, conversational spoken script — not a word-for-word essay to be read flatly, and not just a restatement of the slide's bullets. This is what the presenter actually SAYS while that slide is on screen: expand the point, bridge from what was just said, build belief, and set up what's coming next. It should sound like a real person talking to a room, not a document being narrated. That label line exists only to keep this document aligned to the deck for whoever's reading it — it is invisible structure, never something the presenter actually says, so the spoken script itself must never announce or reference the slide number/title ("on this slide," "moving to slide 12," "here's our big promise slide") — just deliver the actual point directly, exactly as a real presenter would say it with no script visible to the audience at all.

Keep the pacing natural for the format (a 60-90 slide deck runs roughly 60-90 minutes, so most slides get a tight few sentences, not a monologue) but substantial enough that someone with zero prep could read straight through it and deliver an effective, persuasive, on-message presentation — hit the emotional beats (curiosity, belief-shift, credibility, urgency, the ask) each slide exists for rather than just describing what's visible on it.${range ? formatSectionInstruction(range) : ""}`;
}

function formatSectionInstruction(range: WebinarScriptRange): string {
  return `

THIS RESPONSE COVERS ONE SECTION ONLY — part ${range.part} of ${range.parts} of the script. The other parts are being written separately and will be joined to this one in order, so:
- Write the script ONLY for the ${range.count} slides from **Slide ${range.first.number}: ${range.first.title}** through **Slide ${range.last.number}: ${range.last.title}**, in deck order, with no slides skipped.
- Start directly with the **Slide ${range.first.number}: ${range.first.title}** label line — no introduction, preamble, or heading before it.
- Stop right after the script for Slide ${range.last.number}. Do not write anything for later slides.
- Use the rest of the deck only as context, so this section bridges naturally from what came just before it and sets up what comes next.${range.isFinal ? "" : "\n- This is not the end of the presentation — don't wrap up, summarize, or close."}${range.part > 1 ? "\n- This is not the start of the presentation — don't open, greet, or introduce the presenter again." : ""}`;
}
