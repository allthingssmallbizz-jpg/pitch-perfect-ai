"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export async function updateBrandVoice(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const primaryColor = String(formData.get("primary_color") || "").trim();
  const secondaryColor = String(formData.get("secondary_color") || "").trim();
  if (primaryColor && !HEX_COLOR_PATTERN.test(primaryColor)) {
    return { error: "Primary color must be a valid hex code, e.g. #3366FF." };
  }
  if (secondaryColor && !HEX_COLOR_PATTERN.test(secondaryColor)) {
    return { error: "Secondary color must be a valid hex code, e.g. #3366FF." };
  }

  const fields = {
    user_id: user.id,
    tone: String(formData.get("tone") || ""),
    preferred_words: String(formData.get("preferred_words") || ""),
    forbidden_words: String(formData.get("forbidden_words") || ""),
    sample_writing: String(formData.get("sample_writing") || ""),
    extra_notes: String(formData.get("extra_notes") || ""),
    primary_color: primaryColor,
    secondary_color: secondaryColor,
  };

  const { error } = await supabase.from("brand_voices").upsert(fields, { onConflict: "user_id" });

  if (error) {
    return { error: "Could not save your brand voice. Try again." };
  }

  revalidatePath("/brand-voice");
  return { success: true };
}
