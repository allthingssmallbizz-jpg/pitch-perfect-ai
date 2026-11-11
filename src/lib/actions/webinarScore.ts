"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canCreateBioProfile } from "@/lib/ai/presenterBio";
import type { FastActionBonus, StackItem } from "@/types/database";
import {
  webinarScoreAnalysisSchema,
  WEBINAR_REBUILD_THRESHOLD,
  type WebinarScoreCategory,
} from "@/lib/webinarScore/schema";

const clean = (v: string | undefined) => (v ?? "").trim();

// Turns a scored webinar into a real (Live mode) project: Discovery and a new Bio are pre-filled
// with whatever the webinar itself stated, and Discovery's notes carry the score and the framework
// gaps so every agent knows exactly what the rebuild has to fix. The member then confirms and
// completes Discovery and the Bio — nothing extracted is treated as verified.
export async function createProjectFromWebinarScore(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const scoreId = String(formData.get("scoreId") || "");
  const { data: score } = await supabase
    .from("webinar_scores")
    .select("*")
    .eq("id", scoreId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!score || score.status !== "complete") redirect("/webinar-score");

  // Already turned into a project (and it still exists) — go straight there.
  if (score.project_id) {
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("id", score.project_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing) redirect(`/projects/${existing.id}`);
  }

  const parsed = webinarScoreAnalysisSchema.safeParse(score.analysis);
  if (!parsed.success) redirect(`/webinar-score/${scoreId}`);
  const analysis = parsed.data;
  const x = analysis.extracted;
  const categories = (score.analysis as { categories?: WebinarScoreCategory[] }).categories ?? [];

  const { data: profile } = await supabase.from("profiles").select("tier, bonus_niche_limit").eq("id", user.id).single();
  const limitCheck = await canCreateBioProfile(
    supabase,
    user.id,
    profile?.tier ?? "Gold",
    profile?.bonus_niche_limit ?? 0
  );
  if (!limitCheck.ok) redirect(`/webinar-score/${scoreId}?error=project_limit`);

  const projectName = `${score.title || "My webinar"} (rebuild)`;
  const { data: bio, error: bioError } = await supabase
    .from("presenter_bio_profiles")
    .insert({
      user_id: user.id,
      label: projectName,
      presenter_mission: clean(x.presenter.mission),
      presenter_origin_story: clean(x.presenter.origin_story),
      presenter_signature_win: clean(x.presenter.signature_win),
      presenter_setback_story: clean(x.presenter.setback_story),
      presenter_credentials: clean(x.presenter.credentials),
      presenter_years_experience: clean(x.presenter.years_experience),
      presenter_family: clean(x.presenter.family),
      presenter_relatable_detail: clean(x.presenter.relatable_detail),
      presenter_mission_why: clean(x.presenter.mission_why),
    })
    .select("id")
    .single();
  if (bioError || !bio) redirect(`/webinar-score/${scoreId}?error=create_failed`);

  const gaps = categories
    .filter((c) => c.status !== "present")
    .map((c) => `- ${c.label} (${c.points}/${c.max}): ${c.missing || "weak"}${c.how_to_fix ? ` Fix: ${c.how_to_fix}` : ""}`);
  const discoveryNotes = [
    `This project was created from the presenter's existing webinar "${score.title}", which scored ${score.score}/100 against the Pitch Perfect framework${(score.score ?? 0) < WEBINAR_REBUILD_THRESHOLD ? " — it's being rebuilt" : " — it's being improved"}.`,
    gaps.length ? `Framework pieces the rebuild must add or strengthen:\n${gaps.join("\n")}` : "",
    analysis.critical_issues.length
      ? `Claims from the original webinar that need real proof before they're used again:\n${analysis.critical_issues.map((c) => `- ${c.issue}`).join("\n")}`
      : "",
    "The Discovery answers below were pulled from the original webinar — confirm each one is accurate and fill in anything missing.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const stackItems: StackItem[] = x.stack_items
    .filter((s) => s.name.trim())
    .map((s) => ({ name: s.name.trim(), value: s.value.trim(), category: s.category }));
  const fastActionBonuses: FastActionBonus[] = x.fast_action_bonuses
    .filter((b) => b.name.trim())
    .map((b) => ({ name: b.name.trim(), value: b.value.trim(), condition: b.condition.trim() }));

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: projectName,
      presenter_bio_profile_id: bio.id,
      business_name: clean(x.business_name),
      industry: clean(x.industry),
      product: clean(x.product),
      offer_name: clean(x.offer_name),
      audience: clean(x.audience),
      pain_points: clean(x.pain_points),
      false_beliefs: clean(x.false_beliefs),
      desired_transformation: clean(x.desired_transformation),
      enemy: clean(x.enemy),
      differentiator: clean(x.differentiator),
      unique_mechanism: clean(x.unique_mechanism),
      core_promise: clean(x.core_promise),
      outcomes: clean(x.outcomes),
      proof: clean(x.proof),
      price: clean(x.price),
      guarantee: clean(x.guarantee),
      scarcity_urgency: clean(x.scarcity_urgency),
      cta: clean(x.cta),
      stack_items: stackItems,
      fast_action_bonuses: fastActionBonuses,
      discovery_notes: discoveryNotes,
    })
    .select("id")
    .single();
  if (projectError || !project) {
    await supabase.from("presenter_bio_profiles").delete().eq("id", bio.id);
    redirect(`/webinar-score/${scoreId}?error=create_failed`);
  }

  await createAdminClient()
    .from("webinar_scores")
    .update({ project_id: project.id, updated_at: new Date().toISOString() })
    .eq("id", scoreId)
    .eq("user_id", user.id);

  revalidatePath("/", "layout");
  redirect(`/projects/${project.id}?view=discovery#discovery-form`);
}
