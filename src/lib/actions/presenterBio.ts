"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  // Also revalidate the generate pages that show the "finish your bio" reminder, so it clears
  // immediately on the next visit instead of waiting for their own cache to expire.
  revalidatePath("/projects/[id]/generate/[assetType]", "page");
  return { success: true };
}
