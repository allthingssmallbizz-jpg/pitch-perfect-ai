// Targeted edits to an already-generated markdown/text asset (Course Outline first; nothing
// stops another markdown generator from reusing this later) — "add a fourth module on X,"
// "remove the community/accountability section," "rename Module 2 to Y." Distinct from a full
// regenerate: this prompt's whole job is to apply ONLY the requested change and leave everything
// else exactly as it already is, the same reasoning as pageEdit.ts (HTML pages' own equivalent) —
// just without any of that file's HTML-specific machinery (forms, CSS variables, video markers),
// none of which applies to a plain markdown document.

import type { AssetType } from "@/types/database";

export const TEXT_EDIT_CREDIT_COST = 2;
// Has to be able to return the ENTIRE document back, not just the changed fragment. Raised from
// 12000 (comfortably above Course Outline's then-largest 10000-token ceiling) to 24000 when Your
// Signature Webinar (ppt_outline, up to 90 slides) became text-editable too — matches
// PPT_OUTLINE_MAX_OUTPUT_TOKENS exactly, for the same reason that constant itself is 24000: an
// edit to a near-full-length deck echoing the entire thing back is the same real size as the
// original generation, and generateCompleteAsset's own max_tokens continuation, while it exists
// as a safety net, means several extra sequential round-trips inside this route's single
// maxDuration window — better to comfortably fit in one pass than lean on that by default.
export const TEXT_EDIT_MAX_OUTPUT_TOKENS = 24000;

// Per-asset-type rules a generic "add/remove/change" edit has no way to know on its own, so
// without these an edit could easily reintroduce a bug that was already fixed in a fresh
// generation — merge a label onto the same line as its content, add a new line that announces
// "here's the big promise," or title a brand-new slide "Stack Item" the moment the member asks
// for one more bonus added. VSL Script and Webinar Script are the two "word-for-word spoken
// script" formats — their own structural labels ("**N. Stage Name**", "**Slide #: Title**") have
// to stay on their own line and out of the spoken copy itself (see spokenScriptText.ts, which
// strips them for Copy/Read Aloud). Your Signature Webinar (ppt_outline) carries its own version
// of the same risk — see pptOutline.ts's own title/speaker-notes/STACK & PRICE SEQUENCE rules;
// only the highlights that matter for a small targeted edit are repeated here, not the full rule.
const ASSET_TYPE_EDIT_RULES: Partial<Record<AssetType, string>> = {
  vsl_script:
    "- This is a word-for-word spoken script: every beat's label must stay on its own line, exactly as \"**N. Stage Name**\", never merged onto the same line as its spoken copy. The spoken copy itself must never announce or reference its own beat (\"here's the big promise,\" \"now, for the pattern interrupt\") — whatever you add or change should read exactly like something a real presenter would say on camera, with no indication the beat structure exists at all.",
  webinar_script:
    "- This is a word-for-word spoken script: every slide's label must stay on its own line, exactly as \"**Slide #: Title**\", never merged onto the same line as its spoken copy. The spoken copy itself must never announce or reference the slide number/title (\"on this slide,\" \"moving to slide 12\") — whatever you add or change should read exactly like something a real presenter would say on camera, with no script visible to the audience at all.",
  ppt_outline:
    "- A slide's title must never be the bare internal label for what the slide's job is — never \"Slide 13,\" \"Phase 1,\" \"Stack Item,\" \"Full Stack Reveal,\" or similar, even for a brand-new slide you're adding now. This includes the belief-shift/teaching phase (Phase 3) just as much as the offer/stack phase — reported failure: a real deck titled slide after slide literally \"Foundation,\" \"False Belief,\" \"Reframe,\" \"Rhythm\" like a table of contents for the methodology. None of those words, or any synonym/shorthand for them (\"Vehicle Belief,\" \"Secret #1,\" \"Belief Shift,\" etc.), may ever be a title, regardless of which named framework they come from, including ones never mentioned anywhere in this prompt. If asked to fix titles like this, rewrite EVERY one of them in the deck (not just the one slide asked about) to the actual doubt/story/insight that slide is really about — the real objection in the audience's own words, the actual story beat happening on screen — never which stage/secret/belief it structurally is. A stack/recap slide's title must also never comment on the ACT of building/adding/revealing/accumulating value itself — not \"Watch the Numbers Climb,\" not \"Watch This Number Climb,\" not \"Let's Add This One Too,\" not \"Here's One More to Add,\" not any other wording that treats the growing total or the act of adding to it as the subject, even if it's a wording not listed here. The title's subject must always be the actual item/value on screen or the complete current picture (what's included, where things stand) — before finalizing a stack/recap title, check it against this test: is it talking about VALUE, or about the PROCESS of revealing value? If process, rewrite to state the value itself (\"Here's What You're Getting Right Now,\" \"So Here's Where We're At\"). If asked to fix a title like this on an existing slide, rewrite just that title (and nothing else on the slide) to one of these audience-facing forms, and check every other stack/recap slide in the deck for the same mistake while you're in there, fixing all of them the same way. Write the same kind of real, audience-facing headline every other slide already has. Speaker notes must never reference the slide's own number, the underlying PPWOS/PPSOS phase, or the stack/bonus mechanic by name (\"on this slide,\" \"moving to slide 12,\" \"Phase 6,\" \"next stack item\") — a real presenter never narrates any of that out loud. If the change touches the offer/stack/price section, keep the existing sequencing intact: the price never appears before the final full-stack reveal that immediately precedes it, and the guarantee/scarcity/Fast Action Bonus stay before the price, not after.",
};

export function buildTextEditPrompt(currentContent: string, instruction: string, assetType?: AssetType): string {
  const assetTypeRule = assetType ? ASSET_TYPE_EDIT_RULES[assetType] : undefined;
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
${assetTypeRule ? `${assetTypeRule}\n` : ""}- Output ONLY the complete, updated document — no commentary, no markdown code fence, no explanation of what changed, no "Here's the updated version" preamble.`;
}
