import type { AssetType } from "@/types/database";
import { parsePptOutline } from "./pptxParser";

// Turns a generated "word-for-word spoken script" asset's raw markdown into exactly what should
// be spoken or pasted elsewhere — never the structural scaffolding that organizes the document
// for the member building it. Reported: VSL Script's beat labels ("**1. Pre-Hook**", "**4. Big
// Promise**"...) were leaking straight into Copy and Read Aloud, so a real voice tool or
// teleprompter ended up reading/showing "Big Promise" as if it were a line of the actual script.
// Pure, dependency-free text transforms — safe to import from either a server route or a "use
// client" component, same reasoning as pptxParser.ts.

// Strips a VSL beat's own label line entirely (see generators/vslScript.ts's required format:
// "**N. Stage Name**" on its own line, directly above that beat's spoken copy) — never touches
// anything else, so a model that drifted from the exact format (put a label inline with its own
// content, say) just leaves that one line unstripped rather than risking losing real spoken copy
// by forcing a stricter structure onto it. The number+punctuation-right-after-the-digits shape
// is deliberately narrow: ordinary spoken prose that happens to start with a number ("3 months
// from now...") almost never has a period/colon/dash immediately after the digits the way a
// label like "3." or "14a." does, so this doesn't false-positive on real script content.
const VSL_BEAT_LABEL_LINE = /^[ \t]*#{0,4}[ \t]*\*{0,2}[ \t]*\d{1,2}[a-z]?[.):\-–][ \t]*[^*\n]{1,60}\*{0,2}[ \t]*$/gm;

export function stripVslBeatLabels(markdown: string): string {
  return markdown
    .replace(VSL_BEAT_LABEL_LINE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Same reasoning, for Webinar Script's own "**Slide #: Title**" line (see generators/
// webinarScript.ts) — copied straight from the deck it was written for, purely to keep the
// script aligned 1:1 with that deck's slide order for anyone reading the document, never meant
// to be spoken itself.
const WEBINAR_SCRIPT_SLIDE_HEADING_LINE =
  /^[ \t]*#{0,4}[ \t]*\*{0,2}[ \t]*slide[ \t]+\d+[ \t]*[:.\-–]?[ \t]*[^*\n]{0,80}\*{0,2}[ \t]*$/gim;

export function stripWebinarScriptSlideHeadings(markdown: string): string {
  return markdown
    .replace(WEBINAR_SCRIPT_SLIDE_HEADING_LINE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Strips markdown SYNTAX (not structure/labels — see the two functions above for that) so what's
// left reads as plain spoken prose rather than a formatted document. Moved here from TtsPlayer.tsx
// so Copy (GenerateClient.tsx) can produce the exact same clean text Read Aloud actually speaks,
// instead of the two drifting apart.
export function stripMarkdownSyntax(md: string): string {
  return md
    .replace(/^\s*---+\s*$/gm, ". ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Reported: with the practice-mode reduction below, listening still occasionally caught a
// speaker note announcing its own place in the deck — "slide 13," "slide 13 through 14,"
// "moving on to the next slide," and (reported separately, same root cause) "Phase 1," "Phase
// 2" — something no real presenter actually says out loud live; it's planning language, the
// same class of self-reference webinarScript.ts's own prompt already bans in its spoken script.
// pptOutline.ts's own speaker-notes instruction now bans all of this too, but this is the
// defensive half of that fix: it catches the stray reference any already-generated deck still
// has, or a future one that drifts from the instruction anyway, without needing a Regenerate
// first. "slide(s)"/"phase" are specific enough to this exact context that stripping them is
// never going to collide with genuine unrelated spoken content — unlike "day"/"module"/"part",
// which real marketing copy says all the time ("by day 30," "part two of your results"), so
// those PPWOS/PPSOS-style labels are deliberately NOT included here despite being the same kind
// of structural term elsewhere in this app (see SECTION_HEADING in pptxParser.ts).
const SLIDE_NUMBER_REFERENCE = /\bslides?\s*#?\s*\d+\s*(?:(?:through|to|and)\s*\d+|[-–—]\s*\d+)?\b/gi;
const PHASE_NUMBER_REFERENCE = /\bphase\s*#?\s*\d+\s*(?:(?:through|to|and)\s*\d+|[-–—]\s*\d+)?\b/gi;
const NEXT_OR_THIS_SLIDE_PHRASE =
  /\b(?:(?:let'?s\s+)?(?:move|moving|moves|go(?:ing)?)\s+(?:on\s+)?to\s+)?(?:the\s+)?next\s+slide\b|\bon\s+this\s+slide\b/gi;

function stripStructuralSelfReferences(text: string): string {
  return text
    .replace(SLIDE_NUMBER_REFERENCE, "")
    .replace(PHASE_NUMBER_REFERENCE, "")
    .replace(NEXT_OR_THIS_SLIDE_PHRASE, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/([.,!?])[ \t]*[.,]+/g, "$1")
    .replace(/^[ \t]*[.,]\s*/gm, "")
    .replace(/^[ \t]*[-–—]\s*/gm, "")
    .trim();
}

// Reported: Read Aloud was literally saying the words "Speaker notes" before reading the note
// itself. parsePptOutline (pptxParser.ts) normally strips that field's own label line entirely —
// but its fallback path for a label that drifted from the exact expected shape (an extra word, no
// colon, wrapped differently) routes the WHOLE line through looksLikeSpokenProse instead, and a
// long enough label can read as prose and get absorbed into `.notes` label text and all, exactly
// the same class of "the structural scaffolding leaked into the spoken content" bug this whole
// file exists to catch. Defensive, not a fix to the parser itself (which plenty else — the real
// .pptx export, the slide preview — also depends on and shouldn't be touched speculatively):
// strips a leading field-label fragment straight off the extracted text before it's ever spoken.
const FIELD_LABEL_PREFIX =
  /^\s*\*{0,2}\s*(?:speaker'?s?\s+notes|on-?slide\s+content)\*{0,2}\s*(?:\([^)]*\))?\s*[:.\-–]?\s*/i;

function stripLeadingFieldLabel(text: string): string {
  return text.replace(FIELD_LABEL_PREFIX, "").trim();
}

// Reported need: Read Aloud on Your Signature Webinar should work as a rehearsal/practice mode —
// hearing just the title and speaker notes of each slide, back to back, is what actually sounds
// like a presenter running through the talk, since the on-slide bullets are what the AUDIENCE
// reads off the screen, never something a presenter speaks out loud themselves. Reusing
// parsePptOutline (the exact same parser the real .pptx export and the in-app slide preview
// already rely on) rather than a second ad-hoc parser, since the deck's markdown shape is
// identical either way. Bullets are dropped entirely, on purpose.
function extractSlideTitlesAndNotes(markdown: string): string {
  return parsePptOutline(markdown)
    .map((slide) => {
      const title = stripLeadingFieldLabel(slide.title);
      const notes = stripLeadingFieldLabel(slide.notes);
      return stripStructuralSelfReferences([title, notes].filter((part) => part.trim()).join(". "));
    })
    .filter((part) => part.trim())
    .join("\n\n");
}

// The single entry point Copy and Read Aloud both use. A no-op beyond stripMarkdownSyntax for
// every asset type except the "word-for-word spoken script" formats and Your Signature Webinar's
// own practice-mode reduction, so every other asset's Copy/Read Aloud behavior is completely
// unchanged. assetType is optional so callers with no real AssetType to hand it (e.g. the Social
// Compare / Analyzer tools' own TtsPlayer uses) don't need updating just to keep passing a
// type-check.
export function cleanSpokenScript(markdown: string, assetType?: AssetType): string {
  const withoutLabels =
    assetType === "vsl_script"
      ? stripVslBeatLabels(markdown)
      : assetType === "webinar_script"
        ? stripWebinarScriptSlideHeadings(markdown)
        : assetType === "ppt_outline"
          ? extractSlideTitlesAndNotes(markdown)
          : markdown;
  return stripMarkdownSyntax(withoutLabels);
}
