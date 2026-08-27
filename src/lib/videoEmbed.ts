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
