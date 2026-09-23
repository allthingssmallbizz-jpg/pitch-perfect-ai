// "Log in as a member" support — an admin can open a member's account exactly as they see it,
// without ever touching their password (no reset, no email, nothing the member notices), and
// return to their own admin session afterward with one click. See src/lib/actions/admin.ts for
// adminImpersonateMember (starts it) and returnToAdmin (ends it).
//
// How it works: adminImpersonateMember mints a real Supabase session for the target member
// server-side (via the service-role admin client's generateLink + a server-side verifyOtp — the
// link itself is never emailed or shown to anyone), then swaps the browser's normal Supabase
// auth cookies over to that session. Before doing that swap, it stashes the ADMIN's own
// still-valid session in this separate cookie so "Return to admin" can restore it later without
// asking for a password again. httpOnly so it's invisible to any client-side JS (including a
// browser extension or an XSS in an otherwise-unrelated page) and scoped to a few hours so a
// forgotten impersonation session doesn't leave a standing way back to the admin account forever.
export const IMPERSONATOR_COOKIE = "pp_impersonator_session";
export const IMPERSONATOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 4;

export interface ImpersonatorSession {
  access_token: string;
  refresh_token: string;
  // Shown in the "Viewing as a member — return to <email>" banner (see (app)/layout.tsx) so an
  // admin juggling this across tabs always knows which admin account they'll land back on.
  adminEmail: string;
}
