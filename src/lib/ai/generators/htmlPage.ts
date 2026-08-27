// Shared helpers for every generator whose output is a real HTML document (currently Landing
// Page and Thank You Page) rather than markdown — text cleanup, HTML-vs-markdown detection, and
// the CSS custom-property color convention that makes "change the colors after it's generated"
// a simple find-and-replace instead of a full regeneration.
//
// Deliberately dependency-free (a type-only import is the only exception, erased at compile
// time) — GenerateClient.tsx, a "use client" component, imports from this module directly rather
// than from generators/index.ts, which pulls in every generator's buildPrompt function
// (including ones that reach the Node-only knowledge-file loader via systemPrompt.ts) and broke
// the production build when a client component imported from it
// (Turbopack: "the chunking context does not support external modules (request: node:fs)").
import type { AssetType } from "@/types/database";

// Claude is instructed to return raw HTML, but strips a code fence defensively in case it wraps
// it in one anyway (same defensive pattern as parseRatedHeadlines in headlineLab.ts).
export function stripHtmlCodeFence(content: string): string {
  return content.trim().replace(/^```(?:html)?\n?/i, "").replace(/\n?```\s*$/i, "");
}

// Cheap heuristic used client-side to decide whether saved content can actually be rendered as a
// page (a real HTML document) versus something generated before this feature existed, which is
// still plain markdown copy — feeding that into an iframe would look blank/broken rather than
// showing a helpful explanation.
export function looksLikeHtmlDocument(content: string): boolean {
  const head = content.trim().slice(0, 200).toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html");
}

// The 4 custom properties every HTML-page generator is required to declare in :root and use via
// var(...) throughout the rest of its CSS, instead of repeating literal hex codes in every rule.
export const CSS_COLOR_VARS = [
  { name: "--pp-primary", label: "Primary" },
  { name: "--pp-secondary", label: "Secondary" },
  { name: "--pp-accent", label: "Accent" },
  { name: "--pp-outline", label: "Outline / border" },
] as const;

// Dropped into every HTML-page generator's prompt verbatim — one shared source of truth so
// Landing Page and Thank You Page (and anything added later) theme identically.
export const CSS_VAR_DESIGN_BLOCK = `Establish a real visual identity using CSS custom properties, not scattered hardcoded hex values:
- Define exactly these 4 custom properties as the FIRST rule inside your <style> block:
  :root {
    --pp-primary: #......;
    --pp-secondary: #......;
    --pp-accent: #......;
    --pp-outline: #......;
  }
- If BRAND COLORS were supplied in your system prompt, use those exact hex values for these 4 variables in the same roles (primary/secondary/accent/outline). Otherwise choose your own confident, modern palette that fits the niche — not always the same blue.
- Use var(--pp-primary), var(--pp-secondary), var(--pp-accent), and var(--pp-outline) throughout every other CSS rule in the file instead of repeating literal hex codes anywhere else. This is what lets the member change the whole page's color scheme afterward by editing just these 4 lines — follow it exactly, every time, no exceptions, no additional hardcoded colors beyond these 4 plus plain white/black/grays for text and neutrals.
- Use CSS gradients, subtle shadows on cards/buttons, rounded corners, and generous whitespace to create genuine visual polish built from these 4 colors — this should look like a page built by a real designer, not a text document with a border around it.`;

// Extracts the current value of each of the 4 CSS_COLOR_VARS from a generated page's :root block.
// Returns null if the page doesn't declare them at all (content saved before this convention
// existed) — the caller uses that to disable/hide the quick color editor rather than show 4 blank
// or wrong-looking swatches.
export function extractCssColorVars(html: string): Record<string, string> | null {
  const result: Record<string, string> = {};
  for (const { name } of CSS_COLOR_VARS) {
    const match = html.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})`));
    if (!match) return null;
    result[name] = match[1];
  }
  return result;
}

// Swaps just the value of one CSS custom property declaration (the first occurrence, which is
// always the :root definition per the design block above) — a plain string replace, no AI call
// and no regeneration needed to change a page's color scheme after the fact.
export function replaceCssColorVar(html: string, varName: string, newHex: string): string {
  const pattern = new RegExp(`(${varName}\\s*:\\s*)#[0-9a-fA-F]{3,8}`);
  return html.replace(pattern, `$1${newHex}`);
}

// Every generator whose output is a real HTML document (not markdown) — currently Landing Page
// and Thank You Page — used to branch on "is this a webpage, not copy" (GenerateClient's
// preview/color-editor UI, the /api/generate content cleanup step).
export const WEB_PAGE_ASSET_TYPES: AssetType[] = ["landing_page", "thank_you_page"];

// Landing Page's generator prompt is instructed to write the opt-in form's action as this exact
// literal string (see buildLandingPagePrompt) instead of leaving it unwired — /api/generate/route.ts
// then swaps it for the real, generation-specific submission URL right after generation completes
// (generationId is already known by then), the same "placeholder now, real value filled in after"
// pattern the CSS color variables use. Lets the form actually submit — straight into the member's
// Go High Level account via /api/forms/submit/[generationId] — with zero manual wiring, while the
// AI itself never needs to know the real URL (which doesn't exist until the row is saved anyway).
export const FORM_ACTION_PLACEHOLDER = "{{PP_FORM_ACTION}}";

export function injectFormAction(html: string, actionUrl: string): string {
  return html.split(FORM_ACTION_PLACEHOLDER).join(actionUrl);
}
