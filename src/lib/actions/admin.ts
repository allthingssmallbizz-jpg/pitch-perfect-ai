"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, buildLoginCredentialsEmail, EmailSendError } from "@/lib/email";

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

// checkGuardrails (src/lib/credits.ts) lazily resets credits_balance back to
// credits_monthly_allotment the moment credits_reset_at is in the past — a real, wanted feature
// for the normal monthly refill, but it means a manual admin override that doesn't also push
// credits_reset_at forward can get silently clobbered back down the next time that member
// generates something after their reset date passes, with no error and no trace of what happened
// to the balance the admin just set. Both actions below push it forward by the same interval a
// normal reset would (see 0001_init.sql's `now() + interval '1 month'` default), same as if this
// were a fresh reset happening right now — the whole point of an admin manually touching credits
// is "this member's balance is right as of now," which a stale reset date would immediately undo.
function nextMonthlyReset(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

export async function adminSetCredits(_prevState: unknown, formData: FormData) {
  const { supabase } = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const credits = Number(formData.get("credits"));

  if (!userId || !Number.isFinite(credits) || credits < 0) {
    return { error: "Enter a valid, non-negative credit amount." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ credits_balance: Math.floor(credits), credits_reset_at: nextMonthlyReset() })
    .eq("id", userId);
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
    .update({
      credits_balance: Math.max(0, Math.floor(profile.credits_balance + delta)),
      credits_reset_at: nextMonthlyReset(),
    })
    .eq("id", userId);
  if (error) return { error: "Could not update credits." };

  revalidatePath("/admin");
  return { success: true };
}

// Alphanumeric-only (no symbols) so it's easy to read aloud or retype from a text message —
// still well over 60 bits of entropy at this length, plenty for a member account.
function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // no 0/O/1/l/I
  const bytes = randomBytes(14);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

// Creates the account with a password set and the email pre-confirmed — the member can log in
// at /login immediately with the email + password shown in the result, with zero dependency on
// email deliverability. This replaced an inviteUserByEmail flow: that only worked once Custom
// SMTP was fully configured in Supabase (a real outside-service dependency with its own DNS/
// verification steps — see the admin panel's Service accounts card), and until then left a
// member with an email that either never arrived or linked to a broken page, with no way in at
// all. Giving the admin the password directly removes email from the critical path entirely —
// worth still emailing them separately once SMTP is confirmed working, but that's no longer
// required for them to actually get access.
export async function adminInviteMember(_prevState: unknown, formData: FormData) {
  const { supabase } = await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const tier = String(formData.get("tier") || "Member").trim() || "Member";
  const role = formData.get("role") === "admin" ? "admin" : "member";
  const credits = Number(formData.get("credits"));
  const accessMonths = Number(formData.get("access_months"));
  const requestedPassword = String(formData.get("password") || "").trim();

  if (!email || !email.includes("@")) return { error: "Enter a valid email address." };
  if (!Number.isFinite(credits) || credits < 0) return { error: "Enter a valid, non-negative credit amount." };
  if (!Number.isFinite(accessMonths) || accessMonths <= 0) return { error: "Enter a valid access length in months." };
  if (requestedPassword && requestedPassword.length < 8) {
    return { error: "Password must be at least 8 characters — or leave it blank to generate one." };
  }

  const password = requestedPassword || generateTempPassword();

  const { data, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  if (createError || !data.user) {
    return { error: createError?.message || "Could not create the account." };
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
    return {
      error: `Account created (password: ${password}), but couldn't set their starting tier/credits — edit them in the table below. Save that password now, it won't be shown again.`,
    };
  }

  // Best-effort — the password is already shown below regardless, so a failed send (most likely
  // because Custom SMTP/Resend isn't fully configured yet — see the admin panel's Service
  // accounts card) doesn't block account creation, it just means the admin needs to copy the
  // password and send it manually this time.
  let emailSent = false;
  let emailError: string | null = null;
  try {
    const { subject, html } = buildLoginCredentialsEmail({ fullName: fullName || null, email, password });
    await sendEmail({ to: email, subject, html });
    emailSent = true;
  } catch (err) {
    emailError = err instanceof EmailSendError ? err.message : "Could not send the welcome email.";
  }

  revalidatePath("/admin");
  return {
    success: true,
    message: emailSent
      ? `Account ready for ${email} — login details emailed to them.`
      : `Account ready for ${email}. Login email failed to send: ${emailError}`,
    password,
    emailSent,
  };
}

// Regenerates a member's password (the old one can't be retrieved — Supabase never stores or
// exposes plaintext passwords after creation) and emails the new one to them, for when they
// never got the original welcome email or lost it. Same fallback as adminInviteMember: the new
// password is always shown on screen too, so a failed send doesn't leave the admin stuck.
export async function adminResendCredentials(_prevState: unknown, formData: FormData) {
  const { supabase } = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const email = String(formData.get("email") || "");
  const fullName = String(formData.get("fullName") || "").trim();
  if (!userId || !email) return { error: "Member not found." };

  const password = generateTempPassword();
  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
  if (updateError) return { error: updateError.message || "Could not reset their password." };

  let emailSent = false;
  let emailError: string | null = null;
  try {
    const { subject, html } = buildLoginCredentialsEmail({ fullName: fullName || null, email, password });
    await sendEmail({ to: email, subject, html });
    emailSent = true;
  } catch (err) {
    emailError = err instanceof EmailSendError ? err.message : "Could not send the login email.";
  }

  return {
    success: true,
    message: emailSent ? `New password emailed to ${email}.` : `Login email failed to send: ${emailError}`,
    password,
    emailSent,
  };
}

// Lets an admin choose the member's password directly instead of only ever getting a random
// generated one — useful when the welcome/reset email can't be sent (RESEND_API_KEY missing, see
// Environment check above) and the admin would rather hand the member a password they picked
// themselves in person/by text than read a random string off the screen. Deliberately does NOT
// send an email — this is the manual-handoff path, not the automated one (that's still
// adminResendCredentials above); the member can log in with whatever the admin sets the instant
// this returns.
export async function adminSetPassword(_prevState: unknown, formData: FormData) {
  const { supabase } = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const password = String(formData.get("password") || "");
  if (!userId) return { error: "Member not found." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) return { error: error.message || "Could not update their password." };

  return { success: true };
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
