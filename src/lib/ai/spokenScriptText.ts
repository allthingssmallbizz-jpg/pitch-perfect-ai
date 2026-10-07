import type { AssetType } from "@/types/database";

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

// The single entry point Copy and Read Aloud both use. A no-op beyond stripMarkdownSyntax for
// every asset type except the two real "word-for-word spoken script" formats, so every other
// asset's Copy/Read Aloud behavior is completely unchanged. assetType is optional so callers with
// no real AssetType to hand it (e.g. the Social Compare / Analyzer tools' own TtsPlayer uses)
// don't need updating just to keep passing a type-check.
export function cleanSpokenScript(markdown: string, assetType?: AssetType): string {
  const withoutLabels =
    assetType === "vsl_script"
      ? stripVslBeatLabels(markdown)
      : assetType === "webinar_script"
        ? stripWebinarScriptSlideHeadings(markdown)
        : markdown;
  return stripMarkdownSyntax(withoutLabels);
}
