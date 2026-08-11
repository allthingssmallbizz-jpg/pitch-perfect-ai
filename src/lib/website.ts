import { fetchPublicUrl, UnsafeUrlError } from "@/lib/security/safeFetch";

// Fetches a member's own website and reduces it to plain text so it can be handed to Claude as
// raw material for pre-filling the discovery form (see src/lib/ai/websiteImport.ts). No HTML
// parser dependency — a regex strip is good enough for "give the model readable text," not
// pixel-perfect content extraction.

// Vercel serverless functions have a request body/response size ceiling well above this, but a
// multi-megabyte page is almost always a bloated SPA shell or a non-HTML file mislabeled as one
// — bail early rather than pay to download and strip something that won't yield useful text.
const MAX_HTML_BYTES = 3_000_000;
// Keeps the extraction prompt's input bounded — a homepage + about/services page worth of text
// is plenty of signal; there's no benefit to feeding an entire site's markup through the model.
const MAX_TEXT_CHARS = 18_000;

export class WebsiteFetchError extends Error {}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Fetches the given URL and returns cleaned, plain-text content. Throws WebsiteFetchError with a
// member-facing message for anything that should stop the request (bad URL, unreachable site,
// non-HTML response, empty page) — the caller can surface `.message` directly.
export async function fetchWebsiteText(rawUrl: string): Promise<{ text: string; finalUrl: string }> {
  let res: Response;
  try {
    res = await fetchPublicUrl(rawUrl, {
      headers: {
        // Some sites block requests with no browser-like User-Agent.
        "User-Agent":
          "Mozilla/5.0 (compatible; PitchPerfectAI-DiscoveryImport/1.0; +https://pitchperfectai.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (err) {
    throw new WebsiteFetchError(err instanceof Error ? err.message : "Couldn't reach that website.");
  }

  if (!res.ok) {
    throw new WebsiteFetchError(`That website returned an error (${res.status}) — double-check the address.`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) {
    throw new WebsiteFetchError("That address didn't return a webpage the AI can read.");
  }

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > MAX_HTML_BYTES) {
    throw new WebsiteFetchError(
      "That page is too large to import — try a specific page like your homepage or offer page instead of a large site."
    );
  }

  const html = await res.text();
  const text = htmlToText(html).slice(0, MAX_TEXT_CHARS);

  if (text.length < 200) {
    throw new WebsiteFetchError(
      "That page didn't have enough readable text to work with — many site builders render content with JavaScript the AI can't see. Try a different page, or fill this in manually."
    );
  }

  return { text, finalUrl: res.url || rawUrl };
}

export { UnsafeUrlError };
