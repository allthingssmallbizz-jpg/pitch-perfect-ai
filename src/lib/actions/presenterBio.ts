"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMissingBioFieldLabels, canCreateBioProfile } from "@/lib/ai/presenterBio";

// Updates one specific niche profile (identified by the hidden "profileId" field PresenterBioForm
// renders) rather than upserting a single account-wide row — see 0031_niche_bio_profiles.sql for
// why bios moved from one-per-account to many-per-account. Ownership is enforced by the
// `.eq("user_id", user.id)` filter below (belt-and-suspenders alongside RLS).
export async function updatePresenterBio(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profileId = String(formData.get("profileId") || "");
  if (!profileId) return { error: "Missing niche profile." };

  const text = (key: string) => String(formData.get(key) || "");

  const fields = {
    presenter_ihelp_audience: text("presenter_ihelp_audience"),
    presenter_ihelp_outcome: text("presenter_ihelp_outcome"),
    presenter_ihelp_mechanism: text("presenter_ihelp_mechanism"),
    presenter_ihelp_pain_point: text("presenter_ihelp_pain_point"),
    presenter_ihelp_statement: text("presenter_ihelp_statement"),
    presenter_mission: text("presenter_mission"),
    presenter_years_experience: text("presenter_years_experience"),
    presenter_credentials: text("presenter_credentials"),
    presenter_origin_story: text("presenter_origin_story"),
    presenter_signature_win: text("presenter_signature_win"),
    presenter_setback_story: text("presenter_setback_story"),
    presenter_income_goal_6mo: text("presenter_income_goal_6mo"),
    presenter_income_goal_12mo: text("presenter_income_goal_12mo"),
    presenter_mission_why: text("presenter_mission_why"),
    presenter_recognition: text("presenter_recognition"),
    presenter_relatable_detail: text("presenter_relatable_detail"),
  };

  const { error } = await supabase
    .from("presenter_bio_profiles")
    .update(fields)
    .eq("id", profileId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "Could not save this niche. Try again." };
  }

  revalidatePath("/bio");
  revalidatePath(`/bio/${profileId}`);
  // Also revalidate the generate/agent pages that hard-redirect here until the linked niche is
  // filled in (projectNeedsDiscovery's same-shaped gate — see generate/[assetType]/page.tsx and
  // ad-image/page.tsx), so the redirect clears immediately on the next visit.
  revalidatePath("/projects/[id]/generate/[assetType]", "page");
  revalidatePath("/projects/[id]/ad-image", "page");
  revalidatePath("/agents/[assetType]", "page");

  // Set by PresenterBioForm when this page was reached via the "finish your bio first" redirect
  // (?returnTo=... — see generate/[assetType]/page.tsx, ad-image/page.tsx, bio/[profileId]/page.tsx)
  // — finishes that trip by sending them straight back to what they were actually trying to do.
  // Same rule as updateProjectDiscovery's own redirectTo: only actually jump once every required
  // field (REQUIRED_BIO_FIELDS) is filled in — otherwise the generate page's own gate would just
  // bounce them straight back here anyway, so instead stay put and show what's still missing.
  const missing = getMissingBioFieldLabels(fields);
  const returnTo = String(formData.get("redirectTo") || "");
  if (returnTo && missing.length === 0) {
    redirect(returnTo);
  }

  return { success: true, missing };
}

// Creates a new, empty niche — checks the tier limit first (canCreateBioProfile) so a Gold member
// can't quietly rack up unlimited niches through this action even if they never see the disabled
// button. Returns the new profile's id on success so callers (the /bio list page's "+ New niche"
// form, and the project-creation niche picker) can redirect straight into filling it in.
export async function createBioProfile(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const label = String(formData.get("label") || "").trim();
  if (!label) return { error: "Give this niche a name." };
  if (label.length > 60) return { error: "Keep the name under 60 characters." };

  const { data: profile } = await supabase.from("profiles").select("tier, bonus_niche_limit").eq("id", user.id).single();
  const tier = profile?.tier ?? "Gold";
  const bonusNicheLimit = profile?.bonus_niche_limit ?? 0;

  const limitCheck = await canCreateBioProfile(supabase, user.id, tier, bonusNicheLimit);
  if (!limitCheck.ok) return { error: limitCheck.message };

  const { data, error } = await supabase
    .from("presenter_bio_profiles")
    .insert({ user_id: user.id, label })
    .select("id")
    .single();

  if (error || !data) return { error: "Could not create this niche. Try again." };

  revalidatePath("/bio");

  // Set by the project-creation niche picker so a brand-new niche flows straight back into
  // finishing the project it was created for, same returnTo convention used everywhere else this
  // session (see updatePresenterBio above, updateProjectDiscovery's redirectTo).
  const returnTo = String(formData.get("redirectTo") || "");
  redirect(returnTo ? `/bio/${data.id}?returnTo=${encodeURIComponent(returnTo)}` : `/bio/${data.id}`);
}

// Refuses to delete a niche that's still linked to any non-deleted project — silently orphaning a
// project's bio data (leaving presenter_bio_profile_id pointing at nothing, or worse, quietly
// falling back to null) is worse than making someone reassign or delete those projects first.
export async function deleteBioProfile(profileId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("presenter_bio_profile_id", profileId)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if ((count ?? 0) > 0) {
    return { error: "This niche is still used by a project — delete or move that project first." };
  }

  const { error } = await supabase.from("presenter_bio_profiles").delete().eq("id", profileId).eq("user_id", user.id);
  if (error) return { error: "Could not delete this niche. Try again." };

  revalidatePath("/bio");
  return { success: true };
}
