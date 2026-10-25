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
    "- Every slide's two field labels must stay EXACTLY \"**On-slide content**:\" and \"**Speaker notes**:\", on every single slide, even ones nowhere near the change being asked for. Reported real failure: after a few rounds of edits like this one, a deck's labels had quietly drifted to a bare \"Notes:\" — which broke Read Aloud's practice mode (it could no longer tell a note from a bullet) and could leak presenter-only text onto the visible slide in the real export. You are echoing the ENTIRE document back each time, so preserve these two labels verbatim on every slide you pass through, not just the one(s) you were asked to change. Also remove any standalone section-divider line you find sitting between two slides outside the \"**Slide #: Title**\" structure (\"PHASE 3 — CREATE NEW BELIEFS,\" \"Secret #1 — The Vehicle: ...\") — another reported real failure: these get read aloud by Read Aloud as a jarring aside right before the next slide's actual title. Never add a new one either; a slide's phase/secret always lives entirely in its own real title and content, never a separate label line. THE GENERAL RULE for every slide's title in this deck, every phase, no exceptions: it must name the ACTUAL thing being said or shown on that slide, never the ROLE that slide plays in any teaching/sales framework — named in this prompt or not. Test: \"does this title describe what's being said, or which methodology stage this is?\" If it's the stage, it fails. This is not a short banned-word list — every phase of a webinar deck has its own planning vocabulary, and reported real failures have shown up in several different phases, independently: \"Slide 13,\" \"Phase 1\" (structure); \"Stack Item,\" \"Full Stack Reveal,\" and narrating the mechanic itself (\"Watch the Numbers Climb,\" \"Let's Add This One Too\" — title the real item or the real current picture of what's included instead); \"Foundation,\" \"False Belief,\" \"Reframe,\" \"Rhythm,\" \"Vehicle Belief,\" \"Secret #1,\" \"Belief Shift\" (the belief-shift phase — title the real objection in the audience's own words or the real story moment instead); \"Case Study,\" \"Case Study: Before,\" \"Case Study: The Shift,\" \"Case Study: The Results\" (the proof phase — title the actual client/result instead, e.g. \"How Sarah Went From $0 to $10K/Month in 90 Days\"); \"Future Pace,\" \"Future Pace: 90 Days In,\" \"Future Pace: Beyond 90 Days\" (the future-pacing phase — title the actual future moment being painted instead, e.g. \"Picture This 90 Days From Now\"). Treat any OTHER phase/technique/stage name you find on any other slide, from any framework, the exact same way, even if it's not one of the examples just listed. If asked to fix a title like this, don't stop at the one slide asked about — scan the WHOLE deck for every other slide with the same mistake (same phase or a different one) and fix all of them the same way, rewriting only the title (never anything else on those slides). Write the same kind of real, audience-facing headline every other slide already has. Speaker notes must never reference the slide's own number, the underlying PPWOS/PPSOS phase, or the stack/bonus mechanic by name (\"on this slide,\" \"moving to slide 12,\" \"Phase 6,\" \"next stack item\") — a real presenter never narrates any of that out loud. If the change touches the offer/stack/price section, keep the existing sequencing intact: the price never appears before the final full-stack reveal that immediately precedes it, and the guarantee/scarcity/Fast Action Bonus stay before the price, not after. Reported real failure on every stack-section slide (core-offer, each item-introduction, every running-recap, every full-stack reveal, the price reveal): the notes stayed generic filler with no real item name or value in them, while the actual item/value sat only in the bullets — Read Aloud's practice mode (title + notes only, bullets intentionally skipped) read the title then jumped straight to content-free notes, never actually revealing the stack out loud. If asked to fix this, rewrite EVERY stack-section slide's notes (not just the one asked about) to actually say the real item name and value out loud, the way a presenter would say it (\"And I'm also including [item], worth [value], completely free\") — not a verbatim bullet readout, but the real name and number must be IN the notes now, not just on screen. If asked to add the Value Justification Question — a required slide immediately after the final full-stack reveal and immediately before the price reveal, states the total stack value explicitly and asks, word-for-word and never paraphrased, on the slide and in the notes: \"Although I'm not going to charge you [total value] today, if I were to charge you that, would it be worth it?\" (also fix any existing Value Justification slide worded differently to use exactly this) — insert it as its own new slide in exactly that position, renumbering every slide from there through the end of the deck by one, and do not put an actual price (today's real number) on it.",
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
