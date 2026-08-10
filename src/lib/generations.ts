import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Generation, GenerationVersionSource } from "@/types/database";

// Confirms the requesting user owns this generation. Looks the row up with the admin client and
// checks user_id explicitly, rather than relying on the cookie-scoped client + RLS to filter it
// — that used to be the whole check, but any read on the session client that comes back empty
// (RLS denial, a genuinely missing row, or literally any other Postgrest error, since the old
// code never looked at `error`) all collapsed into the same generic "Generation not found,"
// which made a real bug (e.g. a transient auth/session hiccup) indistinguishable from an actually
// bad id. The admin client removes RLS as a variable entirely — ownership is just a plain
// user_id comparison in code — and a genuine Postgrest error is now logged instead of swallowed.
// Shared by every route that edits a generation's content (autosave, explicit save, version
// restore/delete), which otherwise write via the admin client since `generations` has no owner
// UPDATE/INSERT/DELETE policy (service-role only, by design).
export async function getOwnedGeneration(generationId: string): Promise<
  { userId: string; generation: Generation } | { error: string; status: number }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", status: 401 };

  const admin = createAdminClient();
  const { data: generation, error } = await admin.from("generations").select("*").eq("id", generationId).single();
  if (error) {
    // PGRST116 is Postgrest's "no rows" — the expected, unremarkable case of a bad/stale id.
    // Anything else is a real failure worth a trace in the server logs.
    if (error.code !== "PGRST116") console.error("getOwnedGeneration: unexpected error", error);
    return { error: "Generation not found", status: 404 };
  }
  if (!generation) return { error: "Generation not found", status: 404 };
  if (generation.user_id !== user.id) return { error: "Generation not found", status: 404 };

  return { userId: user.id, generation };
}

// Called right after a generation completes (generate/analyze routes, the video pipeline) to
// seed its version history with the AI-produced draft — the baseline every later edit/restore
// is measured against. Best-effort: a failure here shouldn't fail the generation itself, since
// `generations.content` (already written by the caller) remains the source of truth either way.
export async function recordGenerationVersion(
  generationId: string,
  userId: string,
  content: string,
  source: GenerationVersionSource,
  label?: string
): Promise<void> {
  if (!content.trim()) return;
  const admin = createAdminClient();
  await admin.from("generation_versions").insert({ generation_id: generationId, user_id: userId, content, source, label });
}
