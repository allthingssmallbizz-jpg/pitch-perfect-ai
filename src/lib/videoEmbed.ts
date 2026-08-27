// Turns a pasted YouTube/Vimeo/direct-video-file URL into a real, working embed — built entirely
// here from narrowly-validated, extracted IDs, never by asking the AI to construct embed markup
// itself. That's exactly what went wrong before: a freeform "add this video" request sometimes
// got a written description back instead of a real embed, or a mangled/invented embed URL.
//
// This is also a deliberate trust boundary: the server is the ONLY thing that ever produces the
// actual <iframe>/<video> HTML that gets inserted into a page. The client can only ever supply a
// plain source URL (see /api/generations/[id]/edit), never raw HTML — otherwise "insert this
// verbatim" would be a straightforward HTML/script-injection vector into a page that can be
// published live.

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID_PATTERN = /^[0-9]+$/;
const DIRECT_VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov"];

function extractYoutubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id && YOUTUBE_ID_PATTERN.test(id) ? id : null;
    }
    const shortsMatch = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})$/);
    if (shortsMatch) return shortsMatch[1];
    const embedMatch = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})$/);
    if (embedMatch) return embedMatch[1];
  }
  return null;
}

function extractVimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const match = url.pathname.match(/(?:\/video)?\/(\d+)/);
  return match && VIMEO_ID_PATTERN.test(match[1]) ? match[1] : null;
}

export function parseVideoEmbedUrl(rawUrl: string): { html: string; label: string } | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const youtubeId = extractYoutubeId(url);
  if (youtubeId) {
    return {
      label: "YouTube",
      html: `<div style="position:relative;padding-top:56.25%;max-width:100%;overflow:hidden;border-radius:12px;"><iframe src="https://www.youtube.com/embed/${youtubeId}" title="Video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe></div>`,
    };
  }

  const vimeoId = extractVimeoId(url);
  if (vimeoId) {
    return {
      label: "Vimeo",
      html: `<div style="position:relative;padding-top:56.25%;max-width:100%;overflow:hidden;border-radius:12px;"><iframe src="https://player.vimeo.com/video/${vimeoId}" title="Video" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe></div>`,
    };
  }

  const lowerPath = url.pathname.toLowerCase();
  if (DIRECT_VIDEO_EXTENSIONS.some((ext) => lowerPath.endsWith(ext))) {
    const safeUrl = url.toString().replace(/"/g, "&quot;");
    return {
      label: "Video file",
      html: `<video controls preload="metadata" style="width:100%;max-width:100%;border-radius:12px;" src="${safeUrl}"></video>`,
    };
  }

  return null;
}

// Marks the block this module inserts so a later call can find and replace it deterministically
// — no AI involved in placement OR replacement.
const MARKER_START = "<!-- pp-video-embed:start -->";
const MARKER_END = "<!-- pp-video-embed:end -->";

// A fresh RegExp per call, always with the "g" flag — this is deliberate, not incidental. A
// single shared module-level regex with "g" would carry a stale `lastIndex` between calls
// (a classic footgun: `.test()` on a global regex resumes from wherever the last call left off,
// not from the start), and without "g" at all, `.replace()` only ever touches the FIRST match —
// which was the actual bug: after more than one video got added before this fix existed, "remove"
// and "replace" only ever cleaned up one of them, leaving the others stuck on the page forever.
function markedBlockPattern(): RegExp {
  return new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`, "g");
}

function stripAllVideoEmbeds(html: string): string {
  return html.replace(markedBlockPattern(), "");
}

export function hasVideoEmbed(html: string): boolean {
  return html.includes(MARKER_START);
}

// Inserts (or, if one or more already exist, replaces) the page's video embed — a plain string
// operation, not an AI call, so it can never be mangled, reworded, or duplicated the way routing
// it through a freeform edit prompt was. Always normalizes down to exactly one embed: every
// existing marked block is stripped first (self-healing any duplicates stacked by the old bug,
// no matter how many), then the single new block is inserted fresh at a fixed, always-present
// anchor (right before <footer> if the page has one, else right before </body>) rather than
// somewhere an AI decides — less elegant than "under the hero," but 100% reliable, which is what
// actually matters after a video embed silently failing to render at all.
export function upsertVideoEmbed(html: string, embedHtml: string): string {
  const cleaned = stripAllVideoEmbeds(html);
  const block = `${MARKER_START}\n<div style="max-width:720px;margin:32px auto;padding:0 20px;">${embedHtml}</div>\n${MARKER_END}`;

  const footerMatch = cleaned.match(/<footer[\s>]/i);
  if (footerMatch && typeof footerMatch.index === "number") {
    return `${cleaned.slice(0, footerMatch.index)}${block}\n${cleaned.slice(footerMatch.index)}`;
  }

  if (/<\/body>/i.test(cleaned)) {
    return cleaned.replace(/<\/body>/i, `${block}\n</body>`);
  }

  return `${cleaned}\n${block}`;
}

export function removeVideoEmbed(html: string): string {
  return stripAllVideoEmbeds(html);
}
