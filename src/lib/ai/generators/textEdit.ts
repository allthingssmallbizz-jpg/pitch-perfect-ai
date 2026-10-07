// Targeted edits to an already-generated markdown/text asset (Course Outline first; nothing
// stops another markdown generator from reusing this later) — "add a fourth module on X,"
// "remove the community/accountability section," "rename Module 2 to Y." Distinct from a full
// regenerate: this prompt's whole job is to apply ONLY the requested change and leave everything
// else exactly as it already is, the same reasoning as pageEdit.ts (HTML pages' own equivalent) —
// just without any of that file's HTML-specific machinery (forms, CSS variables, video markers),
// none of which applies to a plain markdown document.

import type { AssetType } from "@/types/database";

export const TEXT_EDIT_CREDIT_COST = 2;
// Has to be able to return the ENTIRE document back, not just the changed fragment — comfortably
// above Course Outline's own 10000-token ceiling (the largest current consumer) so a big add
// ("insert two more modules") still fits in one pass.
export const TEXT_EDIT_MAX_OUTPUT_TOKENS = 12000;

// VSL Script and Webinar Script are the two "word-for-word spoken script" formats — their own
// structural labels ("**N. Stage Name**", "**Slide #: Title**") have to stay on their own line
// and out of the spoken copy itself (see spokenScriptText.ts, which strips them for Copy/Read
// Aloud), and the spoken copy must never narrate its own structure. A generic edit has no way to
// know either of those rules on its own, so without this an edit could easily reintroduce the
// exact bug just fixed in a fresh generation — merge a label onto the same line as its content,
// or add a new line that announces "here's the big promise."
const SPOKEN_SCRIPT_EDIT_RULES: Partial<Record<AssetType, string>> = {
  vsl_script:
    "- This is a word-for-word spoken script: every beat's label must stay on its own line, exactly as \"**N. Stage Name**\", never merged onto the same line as its spoken copy. The spoken copy itself must never announce or reference its own beat (\"here's the big promise,\" \"now, for the pattern interrupt\") — whatever you add or change should read exactly like something a real presenter would say on camera, with no indication the beat structure exists at all.",
  webinar_script:
    "- This is a word-for-word spoken script: every slide's label must stay on its own line, exactly as \"**Slide #: Title**\", never merged onto the same line as its spoken copy. The spoken copy itself must never announce or reference the slide number/title (\"on this slide,\" \"moving to slide 12\") — whatever you add or change should read exactly like something a real presenter would say on camera, with no script visible to the audience at all.",
};

export function buildTextEditPrompt(currentContent: string, instruction: string, assetType?: AssetType): string {
  const spokenScriptRule = assetType ? SPOKEN_SCRIPT_EDIT_RULES[assetType] : undefined;
  return `You are making a SPECIFIC, TARGETED edit to an already-finished document — you are not writing a new one from scratch. Apply ONLY the change(s) requested below (things to add, remove, or change). Everything else — structure, wording, sections not mentioned — must come back exactly as it already is, unchanged.

CURRENT DOCUMENT (exactly as it exists right now):
${currentContent}

REQUESTED CHANGE(S):
${instruction}

RULES — read carefully, these override anything above that seems to conflict:
- Preserve the document's existing structure, numbering, and formatting style except where the requested change specifically requires altering it.
- If asked to ADD something (a module, a lesson, a section), integrate it in the most sensible existing location — a new module goes into the module sequence, a new lesson goes inside the module it belongs to — rather than tacking it onto the very end unless that's genuinely where it belongs.
- If asked to REMOVE something, remove it cleanly with no leftover gap, orphaned reference, or broken numbering — renumber whatever needs it (e.g. if Module 3 is removed, the old Module 4 becomes the new Module 3).
- If a name/title is given for something being added, use it exactly as given, verbatim.
${spokenScriptRule ? `${spokenScriptRule}\n` : ""}- Output ONLY the complete, updated document — no commentary, no markdown code fence, no explanation of what changed, no "Here's the updated version" preamble.`;
}
