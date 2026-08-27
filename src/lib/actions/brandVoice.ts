"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const COLOR_FIELDS: { key: string; label: string }[] = [
  { key: "primary_color", label: "Primary color" },
  { key: "secondary_color", label: "Secondary color" },
  { key: "accent_color", label: "Accent color" },
  { key: "outline_color", label: "Outline/border color" },
];

export async function updateBrandVoice(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const colors: Record<string, string> = {};
  for (const { key, label } of COLOR_FIELDS) {
    const value = String(formData.get(key) || "").trim();
    if (value && !HEX_COLOR_PATTERN.test(value)) {
      return { error: `${label} must be a valid hex code, e.g. #3366FF.` };
    }
    colors[key] = value;
  }

  const fields = {
    user_id: user.id,
    tone: String(formData.get("tone") || ""),
    preferred_words: String(formData.get("preferred_words") || ""),
    forbidden_words: String(formData.get("forbidden_words") || ""),
    sample_writing: String(formData.get("sample_writing") || ""),
    extra_notes: String(formData.get("extra_notes") || ""),
    ...colors,
  };

  const { error } = await supabase.from("brand_voices").upsert(fields, { onConflict: "user_id" });

  if (error) {
    return { error: "Could not save your brand voice. Try again." };
  }

  revalidatePath("/brand-voice");
  return { success: true };
}
