import { promises as dns } from "node:dns";
import net from "node:net";

// Fetches a member's own website and reduces it to plain text so it can be handed to Claude as
// raw material for pre-filling the discovery form (see src/lib/ai/websiteImport.ts). No HTML
// parser dependency — a regex strip is good enough for "give the model readable text," not
// pixel-perfect content extraction.

const FETCH_TIMEOUT_MS = 12_000;
// Vercel serverless functions have a request body/response size ceiling well above this, but a
// multi-megabyte page is almost always a bloated SPA shell or a non-HTML file mislabeled as one
// — bail early rather than pay to download and strip something that won't yield useful text.
const MAX_HTML_BYTES = 3_000_000;
// Keeps the extraction prompt's input bounded — a homepage + about/services page worth of text
// is plenty of signal; there's no benefit to feeding an entire site's markup through the model.
const MAX_TEXT_CHARS = 18_000;
const MAX_REDIRECTS = 5;

export class WebsiteFetchError extends Error {}

const UNREACHABLE_MESSAGE = "That address isn't reachable.";

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 169 && b === 254) return true; // link-local / cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIp(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true; // link-local / unique-local
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice(7);
      if (net.isIP(mapped) === 4) return isPrivateIpv4(mapped);
    }
    return false;
  }
  return true; // couldn't parse — treat as unsafe rather than silently allow it through
}

// Resolves the hostname and rejects anything pointing at a private, loopback, or link-local
// address (including the 169.254.169.254 cloud metadata endpoint) — without this, "import from
// your website" would let anyone make the server issue arbitrary requests to its own internal
// network (classic SSRF), just by entering an internal address instead of a real website.
async function assertPublicHost(hostname: string): Promise<void> {
  if (hostname === "localhost") throw new WebsiteFetchError(UNREACHABLE_MESSAGE);
  let records: { address: string }[];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new WebsiteFetchError("Couldn't resolve that website's address — double-check it and try again.");
  }
  if (records.length === 0 || records.some((r) => isPrivateIp(r.address))) {
    throw new WebsiteFetchError(UNREACHABLE_MESSAGE);
  }
}

function normalizeUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) throw new WebsiteFetchError("Enter a website address first.");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new WebsiteFetchError(`"${input}" doesn't look like a valid website address.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new WebsiteFetchError("Only http/https websites are supported.");
  }
  return url;
}

function htmlToText(html: string): string {
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
// non-HTML response, empty page) — the caller can surface `.message` directly. Redirects are
// followed manually (rather than fetch's built-in `redirect: "follow"`) so every hop gets the
// same private-IP check as the original address — otherwise a public URL that 302s to an
// internal one would slip the SSRF guard entirely.
export async function fetchWebsiteText(rawUrl: string): Promise<{ text: string; finalUrl: string }> {
  let url = normalizeUrl(rawUrl);

  let html = "";
  let finalUrl = url.toString();

  for (let redirects = 0; ; redirects++) {
    await assertPublicHost(url.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          // Some sites block requests with no browser-like User-Agent.
          "User-Agent":
            "Mozilla/5.0 (compatible; PitchPerfectAI-DiscoveryImport/1.0; +https://pitchperfectai.app)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new WebsiteFetchError("That website took too long to respond. Try again, or fill this in manually.");
      }
      throw new WebsiteFetchError("Couldn't reach that website — double-check the address and try again.");
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (redirects >= MAX_REDIRECTS) {
        throw new WebsiteFetchError("That website redirected too many times — try linking directly to the final page.");
      }
      url = new URL(res.headers.get("location")!, url);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new WebsiteFetchError(UNREACHABLE_MESSAGE);
      }
      continue;
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

    html = await res.text();
    finalUrl = res.url || url.toString();
    break;
  }

  const text = htmlToText(html).slice(0, MAX_TEXT_CHARS);

  if (text.length < 200) {
    throw new WebsiteFetchError(
      "That page didn't have enough readable text to work with — many site builders render content with JavaScript the AI can't see. Try a different page, or fill this in manually."
    );
  }

  return { text, finalUrl };
}
