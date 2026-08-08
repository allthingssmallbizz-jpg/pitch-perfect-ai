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

  return { supabase, adminUserId: user.id };
}

export async function setKillSwitch(formData: FormData) {
  const { supabase } = await requireAdmin();
  const enabled = formData.get("enabled") === "true";
  const reason = String(formData.get("reason") || "");

  await supabase
    .from("admin_settings")
    .update({ kill_switch_enabled: enabled, kill_switch_reason: reason || null })
    .eq("id", true);

  revalidatePath("/admin");
}

export async function setDailyCap(_prevState: unknown, formData: FormData) {
  const { supabase } = await requireAdmin();
  const cap = Number(formData.get("daily_spend_cap_usd"));

  if (!Number.isFinite(cap) || cap <= 0) {
    return { error: "Enter a valid positive dollar amount." };
  }

  await supabase.from("admin_settings").update({ daily_spend_cap_usd: cap }).eq("id", true);
  revalidatePath("/admin");
  return { success: true };
}

// --- Member management (owner/admin panel: search, credits, roles) ---

export async function adminSetCredits(_prevState: unknown, formData: FormData) {
  const { supabase } = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const credits = Number(formData.get("credits"));

  if (!userId || !Number.isFinite(credits) || credits < 0) {
    return { error: "Enter a valid, non-negative credit amount." };
  }

  const { error } = await supabase.from("profiles").update({ credits_balance: Math.floor(credits) }).eq("id", userId);
  if (error) return { error: "Could not update credits." };

  revalidatePath("/admin");
  return { success: true };
}

export async function adminAddCredits(_prevState: unknown, formData: FormData) {
  const { supabase } = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const delta = Number(formData.get("credits"));

  if (!userId || !Number.isFinite(delta) || delta === 0) {
    return { error: "Enter a non-zero credit amount to add." };
  }

  const { data: profile } = await supabase.from("profiles").select("credits_balance").eq("id", userId).single();
  if (!profile) return { error: "Member not found." };

  const { error } = await supabase
    .from("profiles")
    .update({ credits_balance: Math.max(0, Math.floor(profile.credits_balance + delta)) })
    .eq("id", userId);
  if (error) return { error: "Could not update credits." };

  revalidatePath("/admin");
  return { success: true };
}

export async function adminSetRole(formData: FormData) {
  const { supabase, adminUserId } = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const role = formData.get("role") === "admin" ? "admin" : "member";

  // Prevent an admin from demoting their own account and losing access to this panel —
  // another admin can still change it, but you can't lock yourself out.
  if (userId === adminUserId && role !== "admin") {
    redirect("/admin?error=cant-demote-self");
  }

  await supabase.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/admin");
}
