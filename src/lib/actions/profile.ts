"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateDisplayName(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get("full_name") || "").trim();
  if (!fullName) {
    return { error: "Display name can't be empty." };
  }
  if (fullName.length > 100) {
    return { error: "Keep it under 100 characters." };
  }

  // profiles has an owner UPDATE RLS policy (0001_init.sql), so the cookie-scoped client is
  // enough here — unlike the admin-panel credit/role edits, which need the service role.
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/settings");
  return { success: true };
}
