import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service-role client — bypasses Row Level Security. Server-only.
// NEVER import this from a Client Component or expose SUPABASE_SERVICE_ROLE_KEY to the browser.
// Used for: metering (credit checks/decrements), Stripe webhooks, admin endpoints.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
