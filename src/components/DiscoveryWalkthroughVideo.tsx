import { toEmbedUrl } from "@/lib/embedUrl";

// Shown at the top of the Discovery form when an admin has set admin_settings.discovery_video_url
// (see /admin) — nothing renders otherwise. Built for a membership that skews 45-55+ and often
// has never filled out a marketing discovery brief before; a short video from Aaron walking
// through why each section matters goes a lot further than more on-page text alone.
export default function DiscoveryWalkthroughVideo({ url }: { url: string | null }) {
  if (!url) return null;
  const embedUrl = toEmbedUrl(url);
  if (!embedUrl) return null;

  return (
    <div className="card-elevated mb-4 overflow-hidden rounded-2xl">
      <div className="px-4 pt-4">
        <h3 className="font-display text-sm font-semibold">New here? Watch this first</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          A quick walkthrough of what Discovery is for and how to answer it.
        </p>
      </div>
      <div className="mt-3 aspect-video w-full">
        <iframe
          src={embedUrl}
          title="How to fill out your Discovery brief"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
