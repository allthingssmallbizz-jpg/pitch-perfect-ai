import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Generation, GenerationVersionSource } from "@/types/database";

// Confirms the requesting user owns this generation, using the cookie-scoped client so RLS
// (owner-select-only on `generations`) does the actual enforcement — a row simply won't come
// back for someone else's generation. Shared by every route that edits a generation's content
// (autosave, explicit save, version restore/delete), which otherwise write via the admin client
// since `generations` has no owner UPDATE/INSERT/DELETE policy (service-role only, by design).
export async function getOwnedGeneration(generationId: string): Promise<
  { userId: string; generation: Generation } | { error: string; status: number }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", status: 401 };

  const { data: generation } = await supabase.from("generations").select("*").eq("id", generationId).single();
  if (!generation) return { error: "Generation not found", status: 404 };

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
