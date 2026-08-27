import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";

export const LANDING_PAGE_CREDIT_COST = 3;
// Raised from 2500 — a full, styled HTML document (inline CSS, hero/form/bullets/footer markup)
// runs meaningfully longer than the old copy-only markdown output ever did.
export const LANDING_PAGE_MAX_OUTPUT_TOKENS = 6000;

export function buildLandingPagePrompt(project: Project, priorGenerations: PriorGeneration[] = []): string {
  return `Build a complete, real, ready-to-use landing page (registration/opt-in page, NOT a full sales page) for the project below — an actual styled webpage, not a copy outline. This is the page that gets someone to register for the webinar/VSL or opt in — its only job is the one next action, not a full pitch.

${formatDiscoveryBlock(project)}
${formatPriorGenerationsBlock(priorGenerations)}

OUTPUT FORMAT — read carefully, this overrides the general formatting rules in your system prompt:
Output ONLY a single, complete, self-contained HTML document — starting with <!doctype html> and ending with </html>. No markdown, no commentary, no code fence, nothing before or after it.

Build these sections, in order, as real HTML/CSS (not placeholders or descriptions of what should go there):
1. **Hero** — the Big Promise headline (outcome-led, specific — if a webinar/VSL/sales page already exists above for this project, use its exact headline rather than a different one), a subheadline (who it's for + what they'll walk away with), and a prominent primary CTA button.
2. **Opt-in form** — a visually real form (name + email fields, a submit button labeled with the actual CTA text) styled as a card, positioned near the hero. No <script> tags and no form action/JS wiring — this is a static template the member connects to their own ESP/CRM afterward; leave a single HTML comment noting that near the <form> tag.
3. **What you'll learn/get** — 3-5 benefit-led bullets (not generic, specific to this offer), each with a simple checkmark or icon (inline SVG or a Unicode character is fine — no external icon libraries).
4. **Presenter/authority strip** — one or two lines of credibility, only from supplied proof/presenter bio context; omit this whole section entirely if nothing was supplied, don't invent it.
5. **Final CTA section** — restates the promise and repeats the CTA button, with a time/date placeholder if this is a webinar registration, or "instant access" framing if it's a VSL/download.
6. **Footer** — business name, a one-line privacy/no-spam note (only if something like it was supplied, otherwise a generic honest line like "We respect your inbox — unsubscribe any time"), and a copyright line with the current year.

Design requirements:
- Fully self-contained: all CSS inline in a single <style> block in <head>. No external stylesheets, fonts, scripts, images, or CDN links of any kind — use a system font stack (e.g. -apple-system, "Segoe UI", Roboto, sans-serif) and CSS gradients/colors for visual interest instead of images.
- Real, modern, mobile-responsive design — a centered max-width container, comfortable spacing, a clear visual hierarchy, at least one accent color used consistently for CTAs, and a media query so it holds up on a phone-width screen. This should look like a real landing page a member could screenshot and be proud of, not a bare unstyled document.
- No lorem ipsum and no placeholder brackets like "[headline here]" — every word of copy must be the real, finished copy for this specific offer, grounded in the discovery data above the same way every other generator is.
- Keep total copy short — this page should be readable in under 15 seconds, per the registration-page format. No pricing, no objection handling, no long-form persuasion; that belongs in the sales page.`;
}

// Claude is instructed to return raw HTML, but strips a code fence defensively in case it wraps
// it in one anyway (same defensive pattern as parseRatedHeadlines in headlineLab.ts).
export function stripHtmlCodeFence(content: string): string {
  return content.trim().replace(/^```(?:html)?\n?/i, "").replace(/\n?```\s*$/i, "");
}
