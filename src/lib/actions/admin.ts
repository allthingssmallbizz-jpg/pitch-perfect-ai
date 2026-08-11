"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// `profiles` RLS only allows a row's own owner to UPDATE it (see profiles_update_own in
// 0001_init.sql — there's no admin-update policy, only admin-select). So every mutation an
// admin makes to *another* member's row has to go through the service-role admin client, same
// as the rest of the app's RLS pattern; `supabase` (session-scoped) is only for confirming the
// caller's own identity/role, which the admin-select policy does cover.
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  return { supabase: createAdminClient(), adminUserId: user.id };
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

export async function setDiscoveryVideoUrl(_prevState: unknown, formData: FormData) {
  const { supabase } = await requireAdmin();
  const url = String(formData.get("discovery_video_url") || "").trim();

  if (url && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be|player\.vimeo\.com|vimeo\.com)\//.test(url)) {
    return { error: "Enter a YouTube or Vimeo URL (or leave it blank to hide the video)." };
  }

  await supabase.from("admin_settings").update({ discovery_video_url: url || null }).eq("id", true);
  revalidatePath("/admin");
  revalidatePath("/projects", "layout");
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

export async function adminInviteMember(_prevState: unknown, formData: FormData) {
  const { supabase } = await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const tier = String(formData.get("tier") || "Member").trim() || "Member";
  const role = formData.get("role") === "admin" ? "admin" : "member";
  const credits = Number(formData.get("credits"));
  const accessMonths = Number(formData.get("access_months"));

  if (!email || !email.includes("@")) return { error: "Enter a valid email address." };
  if (!Number.isFinite(credits) || credits < 0) return { error: "Enter a valid, non-negative credit amount." };
  if (!Number.isFinite(accessMonths) || accessMonths <= 0) return { error: "Enter a valid access length in months." };

  // inviteUserByEmail creates the auth.users row (which fires handle_new_user, giving them a
  // default profiles row) and emails them a link to /auth/set-password to choose a password —
  // they never have one set by us. PKCE isn't supported for invites (the browser that sends
  // the invite isn't the one that opens it), so that page reads tokens from the URL fragment.
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/set-password`;
  const { data, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
    redirectTo,
  });
  if (inviteError || !data.user) {
    return { error: inviteError?.message || "Could not send the invite." };
  }

  const accessExpiresAt = new Date();
  accessExpiresAt.setMonth(accessExpiresAt.getMonth() + Math.floor(accessMonths));

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      role,
      tier,
      credits_balance: Math.floor(credits),
      credits_monthly_allotment: Math.floor(credits),
      access_started_at: new Date().toISOString(),
      access_expires_at: accessExpiresAt.toISOString(),
    })
    .eq("id", data.user.id);
  if (profileError) {
    return { error: "Invite sent, but couldn't set their starting tier/credits — edit them in the table below." };
  }

  revalidatePath("/admin");
  return { success: true, message: `Invite sent to ${email}.` };
}

export async function adminSetTier(_prevState: unknown, formData: FormData) {
  const { supabase } = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const tier = String(formData.get("tier") || "").trim();

  if (!userId || !tier) return { error: "Enter a tier label." };
  if (tier.length > 40) return { error: "Keep it under 40 characters." };

  const { error } = await supabase.from("profiles").update({ tier }).eq("id", userId);
  if (error) return { error: "Could not update tier." };

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

// Cuts off a member's access without touching their data — reversible via adminRestoreAccess
// below. Two things happen: access_expires_at moves to right now, which the existing
// access-window check in checkGuardrails (src/lib/credits.ts) already enforces for every paid
// call; and the auth account itself gets banned via Supabase's admin API, so they're also
// blocked from logging in at all, not just from generating. "No access to the system" means
// both, not just one.
export async function adminRevokeAccess(formData: FormData) {
  const { supabase, adminUserId } = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  if (!userId) return;
  if (userId === adminUserId) {
    redirect("/admin?error=cant-revoke-self");
  }

  await supabase.from("profiles").update({ access_expires_at: new Date().toISOString() }).eq("id", userId);
  // ban_duration has no explicit "forever" value in Supabase's API — a long fixed duration
  // (100 years) is the standard way to express "indefinite" until adminRestoreAccess unbans them.
  await supabase.auth.admin.updateUserById(userId, { ban_duration: "876000h" });

  revalidatePath("/admin");
}

export async function adminRestoreAccess(formData: FormData) {
  const { supabase } = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  if (!userId) return;

  const accessExpiresAt = new Date();
  accessExpiresAt.setMonth(accessExpiresAt.getMonth() + 12);

  await supabase.from("profiles").update({ access_expires_at: accessExpiresAt.toISOString() }).eq("id", userId);
  await supabase.auth.admin.updateUserById(userId, { ban_duration: "none" });

  revalidatePath("/admin");
}

// Permanently deletes the auth account. profiles.id references auth.users(id) on delete
// cascade, and every owning table (projects, generations, payments, credit_topups,
// generation_versions) cascades from profiles the same way — so this genuinely removes
// everything tied to this member, not just their login. Irreversible; gated by the typed-email
// confirmation in DeleteMemberButton.tsx, not just a click.
export async function adminDeleteMember(formData: FormData) {
  const { supabase, adminUserId } = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  if (!userId) return;
  if (userId === adminUserId) {
    redirect("/admin?error=cant-delete-self");
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    redirect("/admin?error=delete-failed");
  }

  revalidatePath("/admin");
}
