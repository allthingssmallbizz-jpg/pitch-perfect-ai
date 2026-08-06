"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  return supabase;
}

export async function setKillSwitch(formData: FormData) {
  const supabase = await requireAdmin();
  const enabled = formData.get("enabled") === "true";
  const reason = String(formData.get("reason") || "");

  await supabase
    .from("admin_settings")
    .update({ kill_switch_enabled: enabled, kill_switch_reason: reason || null })
    .eq("id", true);

  revalidatePath("/admin");
}

export async function setDailyCap(_prevState: unknown, formData: FormData) {
  const supabase = await requireAdmin();
  const cap = Number(formData.get("daily_spend_cap_usd"));

  if (!Number.isFinite(cap) || cap <= 0) {
    return { error: "Enter a valid positive dollar amount." };
  }

  await supabase.from("admin_settings").update({ daily_spend_cap_usd: cap }).eq("id", true);
  revalidatePath("/admin");
  return { success: true };
}
