"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMissingBioFieldLabels } from "@/lib/ai/presenterBio";

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

  // Only actually jump once every required field (REQUIRED_BIO_FIELDS) is filled in — otherwise
  // the generate page's own gate (or the project page's bio gate) would just bounce them straight
  // back here anyway, so instead stay put and show what's still missing.
  const missing = getMissingBioFieldLabels(fields);
  if (missing.length === 0) {
    // Set by PresenterBioForm when this page was reached via the "finish your bio first"
    // redirect (?returnTo=... — see generate/[assetType]/page.tsx, ad-image/page.tsx,
    // projects/[id]/page.tsx) — finishes that trip by sending them straight back to what they
    // were actually trying to do. Without a returnTo (arriving here straight from a sidebar tab,
    // the /bio list's "Finish bio" link, or right after creating the project), Bio is only ever
    // step one — Discovery is the very next required step before any agent unlocks (see
    // projectNeedsDiscovery) — so a finished save falls through to that project's own overview
    // page instead of just sitting on a "Saved." message with nowhere to go.
    const returnTo = String(formData.get("redirectTo") || "");
    if (returnTo) redirect(returnTo);

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("presenter_bio_profile_id", profileId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (project) redirect(`/projects/${project.id}`);
  }

  return { success: true, missing };
}

// A bio's linked project going away (deleteProject only sets deleted_at on the project itself —
// see src/lib/actions/projects.ts — never touches the bio row, so a deleted project's tier slot
// frees up without losing that bio's content in case the project is ever restored) leaves this
// row an orphan: getPresenterBioProfiles has no way to know it's no longer reachable through any
// project, so it just keeps showing up on the /bio list with nothing to open it into. Reported by
// Aaron: he deleted a project, and its bio kept appearing there anyway with no way to remove it.
// Only lets an orphan be deleted — a bio still linked to a live project must go through
// deleteProject instead (deleting the bio out from under an active project would leave that
// project pointing at nothing, silently exempting it from the tier limit without actually being
// gone), enforced here rather than trusted to whichever button rendered this action.
export async function deleteBioProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profileId = String(formData.get("profileId") || "");
  if (!profileId) return;

  const { data: linkedProject } = await supabase
    .from("projects")
    .select("id")
    .eq("presenter_bio_profile_id", profileId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (linkedProject) return;

  await supabase.from("presenter_bio_profiles").delete().eq("id", profileId).eq("user_id", user.id);

  revalidatePath("/bio");
}
