import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types/database";

// Every authenticated user should have a `profiles` row — the on_auth_user_created trigger
// (0001_init.sql) creates one at signup. This is a safety net for accounts where that didn't
// happen (created before the trigger existed, or a one-off failure): without it, a missing
// profile row makes pages that query it (billing, settings) behave as if the user weren't
// logged in at all — e.g. billing's old `if (!profile) redirect("/login")` would immediately
// bounce back to /dashboard via the auth middleware's "already logged in" redirect, which is
// exactly the loop this closes off. Row defaults (role, credit balance, access window) come
// from the table schema itself, so inserting just id + email is enough.
export async function ensureProfile(userId: string, email: string): Promise<Profile | null> {
  const admin = createAdminClient();

  const { data: existing } = await admin.from("profiles").select("*").eq("id", userId).single();
  if (existing) return existing;

  const { data: created } = await admin.from("profiles").insert({ id: userId, email }).select("*").single();
  return created ?? null;
}
