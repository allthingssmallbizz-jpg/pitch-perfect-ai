// Targeted edits to an already-generated Landing/Thank You Page — "change the headline to X,"
// "add a testimonial section," "make the CTA button orange," optionally with an uploaded image
// to place somewhere. Distinct from the full generators (landingPage.ts/thankYouPage.ts): this
// prompt's whole job is to touch ONLY what was asked and leave everything else — copy,
// structure, the working form, the color palette — exactly as it already is.

export const PAGE_EDIT_CREDIT_COST = 2;
// Has to be able to return the ENTIRE page back, not just the changed fragment — same ballpark
// as a fresh Landing Page generation.
export const PAGE_EDIT_MAX_OUTPUT_TOKENS = 8000;

export function buildPageEditPrompt(
  currentHtml: string,
  instruction: string,
  options: { imageUrl?: string } = {}
): string {
  return `You are making a SPECIFIC, TARGETED edit to an existing, already-finished HTML page — you are not writing a new page. Apply ONLY the change requested below. Every other word of copy, every other section, and all existing styling must come back exactly as it already is.

CURRENT PAGE (the complete HTML document, exactly as it exists right now):
${currentHtml}

REQUESTED CHANGE:
${instruction || "(No specific text change requested — see the image instructions below, if any.)"}
${
  options.imageUrl
    ? `\nAN IMAGE WAS UPLOADED — it is already hosted at this exact URL. Place it where the request above describes (or, if no placement is described, somewhere sensible like the hero or bio section) using <img src="${options.imageUrl}" alt="..." style="..."> with reasonable sizing/rounding to match the page's existing visual style. Use this URL exactly, verbatim — do not invent a different URL, do not use a placeholder, and do not try to embed the image as base64.`
    : ""
}

RULES — read carefully, these override anything above that seems to conflict:
- Do NOT change the <form> tag's method or action attribute, or any of its input name attributes (name="name" / name="email" / name="phone") — this form is already wired to a real, working submission endpoint; altering it would break real lead capture.
- Do NOT change the four CSS custom properties declared in :root (--pp-primary, --pp-secondary, --pp-accent, --pp-outline) unless the requested change explicitly asks to change a color — those are the page's color system and editing them here would fight the dedicated color picker already on this page.
- If the page contains an HTML comment block marked <!-- pp-video-embed:start --> ... <!-- pp-video-embed:end -->, leave that entire block byte-for-byte untouched — do not move it, rewrite it, reformat it, or remove it, even while making unrelated changes elsewhere on the page. It's a working video embed inserted separately from this request.
- Do NOT add any <script> tags.
- Output ONLY the complete, updated HTML document — starting with <!doctype html> and ending with </html>. No markdown, no commentary, no code fence, nothing before or after it, and no explanation of what changed.`;
}
