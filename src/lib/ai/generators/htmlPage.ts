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

// The message "source" tag used by the inline-editor script below and read back by
// GenerateClient's postMessage listener — namespaced so it can never be confused with a message
// from anything else running in that window (a browser extension, devtools, etc.).
export const INLINE_EDITOR_MESSAGE_SOURCE = "pp-inline-editor";

// Wraps a generated page with a small, TRUSTED script — authored here, never by the AI — that
// (1) makes visible text content directly editable in place, and (2) shows a small × button over
// whichever block-level element (section/div/img/video/iframe/figure/article/aside/form) the
// mouse is over, deleting that exact element on click. Both report the updated document back to
// the parent window via postMessage. Used only for the iframe's srcDoc in GenerateClient's
// "Edit inline" view mode; never written back into generations.content itself.
//
// The delete button exists specifically so removing something unwanted (a stray/duplicate
// section, an embed that didn't come out right) is a direct, deterministic, one-click action —
// never a "please remove X" request handed to an AI to go find and interpret, which is what
// proved unreliable in practice.
//
// This requires the iframe's sandbox to include "allow-scripts" (see GenerateClient), which is
// deliberately NOT paired with "allow-same-origin" — the frame keeps a unique, opaque origin, so
// even if the AI-generated content violated its instructions and included a stray <script> tag,
// that script would still be unable to read cookies, local storage, or reach this app's own
// origin. postMessage works across that boundary by design, which is all this editor needs.
export function buildEditableHtml(html: string): string {
  const editorScript = `<script>(function(){
var SOURCE=${JSON.stringify(INLINE_EDITOR_MESSAGE_SOURCE)};
var SELECTOR="h1,h2,h3,h4,h5,h6,p,span,a,li,button,label,small,blockquote,figcaption";
document.querySelectorAll(SELECTOR).forEach(function(el){
  if(el.children.length>0)return;
  if(!el.textContent||!el.textContent.trim())return;
  el.setAttribute("contenteditable","true");
  el.addEventListener("focus",function(){el.style.outline="2px dashed rgba(99,102,241,0.6)";el.style.outlineOffset="2px";});
  el.addEventListener("blur",function(){el.style.outline="none";report();});
});
document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a");if(a)e.preventDefault();},true);
var timer=null;
function report(){clearTimeout(timer);timer=setTimeout(function(){parent.postMessage({source:SOURCE,html:document.documentElement.outerHTML},"*");},300);}
document.addEventListener("input",report,true);

var DEL_SELECTOR="section,div,img,video,iframe,figure,article,aside,form";
var delBtn=null,delTarget=null,hideTimer=null;
function cancelHide(){if(hideTimer){clearTimeout(hideTimer);hideTimer=null;}}
function clearDelBtn(){if(delBtn){delBtn.remove();delBtn=null;}delTarget=null;}
function scheduleHide(){cancelHide();hideTimer=setTimeout(clearDelBtn,250);}
function positionDelBtn(){
  if(!delBtn||!delTarget)return;
  var r=delTarget.getBoundingClientRect();
  delBtn.style.top=Math.max(4,r.top+4)+"px";
  delBtn.style.left=Math.max(4,r.right-32)+"px";
}
function showDelBtn(target){
  if(delTarget===target)return;
  clearDelBtn();
  delTarget=target;
  delBtn=document.createElement("button");
  delBtn.textContent="\\u00d7";
  delBtn.setAttribute("contenteditable","false");
  delBtn.title="Delete this section";
  // 28px is a compromise, not full accessibility-guideline sizing (44px) — this is a floating
  // badge over arbitrary AI-generated content, and a bigger hit area would more often overlap
  // neighboring text/buttons on a small mobile viewport. It responds to both mouse and touch.
  delBtn.style.cssText="position:fixed;width:28px;height:28px;border-radius:14px;background:#ef4444;color:#fff;border:2px solid #fff;font-size:16px;line-height:24px;text-align:center;padding:0;cursor:pointer;touch-action:manipulation;z-index:2147483647;box-shadow:0 1px 4px rgba(0,0,0,.35);";
  delBtn.addEventListener("mousedown",function(e){e.preventDefault();e.stopPropagation();});
  delBtn.addEventListener("mouseenter",cancelHide);
  delBtn.addEventListener("mouseleave",scheduleHide);
  delBtn.addEventListener("click",function(e){
    e.preventDefault();e.stopPropagation();
    if(!delTarget)return;
    if(window.confirm("Delete this section from the page?")){
      var t=delTarget;
      clearDelBtn();
      t.remove();
      report();
    }
  });
  document.body.appendChild(delBtn);
  positionDelBtn();
}
// Hover shows/hides the button on desktop (mouse). Touchscreens have no hover at all, so a tap
// on any deletable block also shows it (a second tap, on the button itself, deletes) — without
// this, the entire click-to-delete feature would be invisible and unusable on a phone.
document.addEventListener("mouseover",function(e){
  var target=e.target&&e.target.closest&&e.target.closest(DEL_SELECTOR);
  if(!target||target===document.body||target===document.documentElement)return;
  if(target.getBoundingClientRect().height>document.documentElement.scrollHeight*0.85)return;
  cancelHide();
  showDelBtn(target);
});
document.addEventListener("mouseout",function(e){
  if(e.target&&e.target.closest&&e.target.closest(DEL_SELECTOR))scheduleHide();
});
document.addEventListener("click",function(e){
  var target=e.target&&e.target.closest&&e.target.closest(DEL_SELECTOR);
  if(!target||target===document.body||target===document.documentElement||target.getBoundingClientRect().height>document.documentElement.scrollHeight*0.85){
    clearDelBtn();
    return;
  }
  cancelHide();
  showDelBtn(target);
});
document.addEventListener("scroll",positionDelBtn,true);
window.addEventListener("resize",positionDelBtn);
})();</script>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${editorScript}</body>`) : `${html}${editorScript}`;
}
