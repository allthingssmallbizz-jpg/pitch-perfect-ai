import { fetchPublicUrl } from "@/lib/security/safeFetch";
import { htmlToText } from "@/lib/website";

// Best-effort extraction from a social profile URL (TikTok/Instagram/Facebook/other) for the
// social media comparison tool (src/lib/ai/socialCompare.ts). These platforms are JS-rendered
// single-page apps that actively block scraping, so a plain fetch-and-strip (which works fine
// for ordinary websites, see src/lib/website.ts) mostly returns an empty shell. What DOES
// reliably survive server-side rendering on every major platform is the Open Graph / Twitter
// Card meta tags — every platform maintains these deliberately, because they're what makes a
// pasted link unfurl correctly in iMessage/Slack/Discord/etc. So instead of trying to scrape a
// full post history (not realistically possible without official API access), this pulls
// whatever bio/title/description text and preview image the platform explicitly publishes for
// link previews, and is upfront with the caller when that yields too little to work with.

const MAX_HTML_BYTES = 3_000_000;
const MAX_IMAGE_BYTES = 6_000_000;
const BODY_TEXT_CHARS = 4000;

export class SocialFetchError extends Error {}

export type SocialPlatform = "tiktok" | "instagram" | "facebook" | "other";

export type SocialImage = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

export type SocialProfileExtraction = {
  finalUrl: string;
  platform: SocialPlatform;
  title: string;
  description: string;
  bodyTextSnippet: string;
  image?: SocialImage;
};

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

function extractMetaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtmlEntities(m[1]);
  }
  return null;
}

function extractTitleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1] ? decodeHtmlEntities(m[1]) : null;
}

function detectPlatform(hostname: string): SocialPlatform {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  if (h.endsWith("tiktok.com")) return "tiktok";
  if (h.endsWith("instagram.com")) return "instagram";
  if (h.endsWith("facebook.com") || h.endsWith("fb.com")) return "facebook";
  return "other";
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  other: "That",
};

function mediaTypeFromContentType(contentType: string): SocialImage["mediaType"] | null {
  if (contentType.includes("png")) return "image/png";
  if (contentType.includes("webp")) return "image/webp";
  if (contentType.includes("gif")) return "image/gif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "image/jpeg";
  return null;
}

// Best-effort — a failure here (blocked, too large, wrong type) just means the comparison
// proceeds without a visual for this page rather than failing the whole request.
async function tryFetchPreviewImage(imageUrl: string, pageUrl: string): Promise<SocialImage | undefined> {
  try {
    const absolute = new URL(imageUrl, pageUrl).toString();
    const res = await fetchPublicUrl(absolute, { headers: { Accept: "image/*" } });
    if (!res.ok) return undefined;
    const mediaType = mediaTypeFromContentType(res.headers.get("content-type") ?? "");
    if (!mediaType) return undefined;
    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > MAX_IMAGE_BYTES) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_IMAGE_BYTES) return undefined;
    return { base64: buf.toString("base64"), mediaType };
  } catch {
    return undefined;
  }
}

export async function fetchSocialProfile(rawUrl: string): Promise<SocialProfileExtraction> {
  let res: Response;
  try {
    res = await fetchPublicUrl(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (err) {
    throw new SocialFetchError(err instanceof Error ? err.message : "Couldn't reach that page.");
  }

  if (!res.ok) {
    throw new SocialFetchError(`That page returned an error (${res.status}) — double-check the link.`);
  }

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > MAX_HTML_BYTES) {
    throw new SocialFetchError("That page is too large to read.");
  }

  const finalUrl = res.url || rawUrl;
  const platform = detectPlatform(new URL(finalUrl).hostname);
  const html = await res.text();

  const title = extractMetaContent(html, "og:title") ?? extractTitleTag(html) ?? "";
  const description = extractMetaContent(html, "og:description") ?? extractMetaContent(html, "description") ?? "";
  const ogImageUrl = extractMetaContent(html, "og:image");
  const bodyTextSnippet = htmlToText(html).slice(0, BODY_TEXT_CHARS);
  const image = ogImageUrl ? await tryFetchPreviewImage(ogImageUrl, finalUrl) : undefined;

  if (!title && !description && bodyTextSnippet.length < 100 && !image) {
    throw new SocialFetchError(
      `${PLATFORM_LABELS[platform]} page didn't return anything readable — these platforms often block automated reading entirely for a given page or require login to view it. Try a different link (a public profile or a specific public post usually works better than a locked-down page).`
    );
  }

  return { finalUrl, platform, title, description, bodyTextSnippet, image };
}
