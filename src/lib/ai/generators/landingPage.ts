import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";
import { CSS_VAR_DESIGN_BLOCK, FORM_ACTION_PLACEHOLDER } from "./htmlPage";

export const LANDING_PAGE_CREDIT_COST = 3;
// Raised from 2500, then 6000, then 8000 — a full, richly-styled multi-section HTML document
// (two-column hero, form, bio, benefits, proof, FAQ, footer, all with real inline CSS) runs
// considerably longer than the old copy-only markdown output ever did.
export const LANDING_PAGE_MAX_OUTPUT_TOKENS = 8000;

export function buildLandingPagePrompt(project: Project, priorGenerations: PriorGeneration[] = []): string {
  return `Build a complete, real, ready-to-use landing page (registration/opt-in page, NOT a full sales page) for the project below — a genuinely well-designed webpage a member would be proud to put their name on, not a bland placeholder. This is the page that gets someone to register for the webinar/VSL or opt in — its only job is the one next action, not a full pitch.

${formatDiscoveryBlock(project)}
${formatPriorGenerationsBlock(priorGenerations)}

OUTPUT FORMAT — read carefully, this overrides the general formatting rules in your system prompt:
Output ONLY a single, complete, self-contained HTML document — starting with <!doctype html> and ending with </html>. No markdown, no commentary, no code fence, nothing before or after it.

Build these sections, in order, as real HTML/CSS (not placeholders or descriptions of what should go there):

1. **Hero — two columns, form always top-right.** A two-column layout (grid or flex, roughly 3:2 width split): the LEFT column holds the Big Promise headline (outcome-led, specific — if a webinar/VSL/sales page already exists above for this project, use its exact headline rather than a different one), a subheadline (who it's for + what they'll walk away with), and 2-3 short supporting trust bullets. The RIGHT column, positioned at the top of the page next to the hero copy (not below it, not further down the page), holds the opt-in form as a raised card. Build the <form> tag EXACTLY like this, verbatim, so it actually submits somewhere real: \`<form method="POST" action="${FORM_ACTION_PLACEHOLDER}">\`. Inside it, three fields with these EXACT \`name\` attributes (this is how the submission is read on the other end — do not rename or omit any of them): an input named \`name\` (Name), an input named \`email\` (type="email"), and an input named \`phone\` (type="tel"). Add a submit button labeled with the actual CTA text, and one small reassurance line under the button (e.g. "We'll never spam you — unsubscribe any time"). Still no <script> tags anywhere in the document — this form works via a plain HTML POST, no JavaScript involved. On narrow/mobile screens, stack the form directly under the hero copy so it still appears immediately, not lower on the page.
2. **Benefits & transformation** — not generic bullet points. For each of 4-6 items, pair a concrete BEFORE state with the AFTER transformation this offer creates (e.g. "Before: guessing at pricing and hoping. After: a repeatable pricing formula you use on every call."). Use a simple inline SVG checkmark or icon per item, laid out in a clean grid/list — this is the section doing the most persuasive work on the page, give it real visual weight, not an afterthought.
3. **Meet your host / bio section** — if presenter bio context was supplied in your system prompt, build a real section here: a circular avatar placeholder (CSS-only — initials on a gradient background, no image file), their name, one line of credentials/years of experience, and a short 2-3 sentence bio pulling from their mission and origin story. If no presenter bio context exists at all, omit this entire section rather than inventing one.
4. **Proof / social proof** — only from the project's supplied "Proof" field; if real proof exists, present it as a short, credible strip (a stat, a named result, or a testimonial-style quote). If nothing was supplied, omit this section entirely rather than fabricating a testimonial.
5. **A few quick answers (mini-FAQ)** — 3 short Q&A pairs addressing the most obvious hesitations for this specific offer (time commitment, cost/free, what happens after signup) — keep answers to one sentence each, this is reassurance, not an objection-handling essay.
6. **Final CTA section** — restates the promise and repeats the CTA button prominently, with a time/date placeholder if this is a webinar registration, or "instant access" framing if it's a VSL/download.
7. **Footer** — business name, a one-line privacy/no-spam note (only if something like it was supplied, otherwise a generic honest line like "We respect your privacy — your info is never sold or shared"), and a copyright line with the current year.

Design requirements — this must NOT look bland, generic, or like an unstyled wireframe:
- Fully self-contained: all CSS inline in a single <style> block in <head>. No external stylesheets, fonts, scripts, images, or CDN links of any kind — use a system font stack (e.g. -apple-system, "Segoe UI", Roboto, sans-serif).
- ${CSS_VAR_DESIGN_BLOCK}
- Real, modern, mobile-responsive design with at least one media query for phone-width screens (hero collapses to one column, form stays near the top as described above).
- Give every section real visual separation (alternating background tints, card treatments, or spacing) so the page doesn't read as one undifferentiated wall of text.
- No lorem ipsum and no placeholder brackets like "[headline here]" — every word of copy must be the real, finished copy for this specific offer, grounded in the discovery data above the same way every other generator is. Omit an entire section cleanly (per the rules above) rather than filling it with invented specifics.
- Keep total copy tight and scannable — this is still a registration page, not a full sales page. No pricing breakdown, no full objection-handling section beyond the mini-FAQ; that belongs in the sales page.`;
}
