import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Turns a title into a URL-safe slug — lowercased, non-alphanumerics collapsed to single
// hyphens, trimmed of leading/trailing hyphens, capped to a sane length. Falls back to "page"
// if the input has no alphanumeric characters at all (an empty/emoji-only project name).
function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "page";
}

// Picks a slug for a newly-published page: the plain slugified seed (usually the project name)
// if it's free, otherwise the seed with a short random suffix — tried a few times before falling
// back to a timestamp suffix, which is guaranteed unique. Called once per generation the first
// time it's published; the result is stored in generations.publish_slug and reused on every
// later publish/unpublish so a shared link never changes.
export async function generateUniqueSlug(admin: SupabaseClient<Database>, seed: string): Promise<string> {
  const base = slugify(seed);
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data } = await admin.from("generations").select("id").eq("publish_slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export function getAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function getPublicSiteUrl(slug: string): string {
  return `${getAppBaseUrl()}/site/${slug}`;
}

export function getFormSubmitUrl(generationId: string): string {
  return `${getAppBaseUrl()}/api/forms/submit/${generationId}`;
}
