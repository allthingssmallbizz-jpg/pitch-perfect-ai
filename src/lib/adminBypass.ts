import { createAdminClient } from "@/lib/supabase/admin";

// The single check every bio/discovery completeness gate in the app calls before actually
// blocking someone — see admin_settings.admin_restrictions_disabled's own comment for why this
// exists (a live demo/webinar can't stop to fill out a 24-question discovery brief on stage).
// True only for an admin AND only while the switch an admin flipped in /admin is on — a regular
// member's role is never "admin," so this is always false for them regardless of the switch,
// and an admin who hasn't flipped the switch still gets blocked exactly like everyone else.
//
// Uses the service-role admin client (like checkGuardrails in src/lib/credits.ts, for the same
// reason) rather than trusting whatever session-scoped client a caller has on hand —
// admin_settings' RLS is admin-select-only, so a regular member's own client can't read this
// column at all, and this needs a reliable answer regardless of who's asking.
export async function isRestrictionBypassActive(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).single(),
    supabase.from("admin_settings").select("admin_restrictions_disabled").eq("id", true).single(),
  ]);
  return profile?.role === "admin" && !!settings?.admin_restrictions_disabled;
}
