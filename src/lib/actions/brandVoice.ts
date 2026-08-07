"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateBrandVoice(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fields = {
    user_id: user.id,
    tone: String(formData.get("tone") || ""),
    preferred_words: String(formData.get("preferred_words") || ""),
    forbidden_words: String(formData.get("forbidden_words") || ""),
    sample_writing: String(formData.get("sample_writing") || ""),
    extra_notes: String(formData.get("extra_notes") || ""),
  };

  const { error } = await supabase.from("brand_voices").upsert(fields, { onConflict: "user_id" });

  if (error) {
    return { error: "Could not save your brand voice. Try again." };
  }

  revalidatePath("/brand-voice");
  return { success: true };
}
