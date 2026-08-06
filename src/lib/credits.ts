import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types/database";

const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 5);
const RATE_LIMIT_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR ?? 30);

export type GuardrailFailureReason =
  | "access_expired"
  | "insufficient_credits"
  | "rate_limited_minute"
  | "rate_limited_hour"
  | "kill_switch"
  | "daily_cap_reached";

export interface GuardrailResult {
  ok: boolean;
  reason?: GuardrailFailureReason;
  message?: string;
  profile?: Profile;
}

// All server-side, per the build spec's metering pattern: "every generation → check
// credits → call the API → record tokens/cost → decrement credits. All server-side
// (never trust the browser for limits)." This is the single gate every generator call
// must pass through before spending a token on the Anthropic API.
export async function checkGuardrails(userId: string, creditCost: number): Promise<GuardrailResult> {
  const supabase = createAdminClient();

  // 1. Global kill switch — an admin can halt all generations instantly.
  const { data: settings } = await supabase.from("admin_settings").select("*").eq("id", true).single();
  if (settings?.kill_switch_enabled) {
    return { ok: false, reason: "kill_switch", message: settings.kill_switch_reason || "Generations are temporarily paused by an admin." };
  }

  // 2. Global daily spend cap — protects against a bug or coordinated abuse blowing the budget.
  if (settings) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { data: todaysGenerations } = await supabase
      .from("generations")
      .select("cost_usd")
      .gte("created_at", startOfDay.toISOString());
    const todaysSpend = (todaysGenerations ?? []).reduce((sum, g) => sum + Number(g.cost_usd ?? 0), 0);
    if (todaysSpend >= Number(settings.daily_spend_cap_usd)) {
      return { ok: false, reason: "daily_cap_reached", message: "Daily generation budget reached. Try again tomorrow." };
    }
  }

  // 3. Profile: access window + credit balance (rolling monthly reset applied lazily here).
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (!profile) {
    return { ok: false, reason: "access_expired", message: "Account not found." };
  }

  if (new Date(profile.access_expires_at) < new Date()) {
    return { ok: false, reason: "access_expired", message: "Your 12-month access window has expired. Renew to keep generating." };
  }

  let effectiveProfile = profile;
  if (new Date(profile.credits_reset_at) < new Date()) {
    const { data: refreshed } = await supabase
      .from("profiles")
      .update({
        credits_balance: profile.credits_monthly_allotment,
        credits_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", userId)
      .select("*")
      .single();
    if (refreshed) effectiveProfile = refreshed;
  }

  if (effectiveProfile.credits_balance < creditCost) {
    return { ok: false, reason: "insufficient_credits", message: "Not enough credits for this generation. Buy a top-up or wait for your monthly reset.", profile: effectiveProfile };
  }

  // 4. Rate limiting — stops runaway loops/abuse regardless of remaining balance.
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: countLastMinute } = await supabase
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneMinuteAgo);
  if ((countLastMinute ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    return { ok: false, reason: "rate_limited_minute", message: `Too many generations — max ${RATE_LIMIT_PER_MINUTE} per minute.`, profile: effectiveProfile };
  }

  const { count: countLastHour } = await supabase
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneHourAgo);
  if ((countLastHour ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return { ok: false, reason: "rate_limited_hour", message: `Too many generations — max ${RATE_LIMIT_PER_HOUR} per hour.`, profile: effectiveProfile };
  }

  return { ok: true, profile: effectiveProfile };
}

// Decrements the user's balance by the asset's credit cost. Called only after a
// successful generation so a failed API call never costs the user credits.
export async function decrementCredits(userId: string, creditCost: number): Promise<void> {
  const supabase = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("credits_balance").eq("id", userId).single();
  if (!profile) return;
  await supabase
    .from("profiles")
    .update({ credits_balance: Math.max(0, profile.credits_balance - creditCost) })
    .eq("id", userId);
}
