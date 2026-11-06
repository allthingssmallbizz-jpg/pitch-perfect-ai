// Ownership + "is this still the current review" checks shared by the recommendation and coach
// routes. Decisions can only be recorded on the project's latest review — older reviews are
// history, and editing them could make the approved blueprint disagree with what's on screen.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Project, StrategyRecommendation, StrategyReview } from "@/types/database";

export async function getOwnedCurrentRecommendation(recId: string): Promise<
  | { userId: string; rec: StrategyRecommendation; review: StrategyReview; project: Project }
  | { error: string; status: number }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", status: 401 };
  const admin = createAdminClient();
  const { data: rec } = await admin.from("strategy_recommendations").select("*").eq("id", recId).maybeSingle();
  if (!rec || rec.user_id !== user.id) return { error: "Recommendation not found", status: 404 };
  const [{ data: review }, { data: latest }, { data: project }] = await Promise.all([
    admin.from("strategy_reviews").select("*").eq("id", rec.review_id).maybeSingle(),
    admin
      .from("strategy_reviews")
      .select("id")
      .eq("project_id", rec.project_id)
      .order("review_version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("projects").select("*").eq("id", rec.project_id).is("deleted_at", null).maybeSingle(),
  ]);
  if (!review || !project || project.user_id !== user.id) return { error: "Recommendation not found", status: 404 };
  if (latest?.id !== review.id) {
    return { error: "This review has been replaced by a newer one — refresh to see the latest.", status: 409 };
  }
  return { userId: user.id, rec, review, project };
}
