// Converts a normal YouTube/Vimeo URL (whatever an admin would actually copy out of the address
// bar) into the iframe-embeddable form. Used for the optional Discovery walkthrough video —
// see admin_settings.discovery_video_url.
export function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);

    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.pathname.startsWith("/embed/")) return url;
    }

    if (u.hostname === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }

    if (u.hostname === "player.vimeo.com") return url;

    return null;
  } catch {
    return null;
  }
}
