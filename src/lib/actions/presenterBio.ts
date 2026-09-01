"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMissingBioFieldLabels } from "@/lib/ai/presenterBio";

// Same pattern as updateBrandVoice — one row per user, upserted, filled in once on its own /bio
// page instead of per-project.
export async function updatePresenterBio(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const text = (key: string) => String(formData.get(key) || "");

  const fields = {
    user_id: user.id,
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

  const { error } = await supabase.from("presenter_bios").upsert(fields, { onConflict: "user_id" });

  if (error) {
    return { error: "Could not save your bio. Try again." };
  }

  revalidatePath("/bio");
  // Also revalidate the generate/agent pages that hard-redirect here until the bio is filled in
  // (projectNeedsDiscovery's same-shaped gate — see generate/[assetType]/page.tsx and
  // ad-image/page.tsx), so the redirect clears immediately on the next visit.
  revalidatePath("/projects/[id]/generate/[assetType]", "page");
  revalidatePath("/projects/[id]/ad-image", "page");
  revalidatePath("/agents/[assetType]", "page");

  // Set by PresenterBioForm when this page was reached via the "finish your bio first" redirect
  // (?returnTo=... — see generate/[assetType]/page.tsx, ad-image/page.tsx, bio/page.tsx) —
  // finishes that trip by sending them straight back to what they were actually trying to do.
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
