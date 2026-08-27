"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Same owner-scoped upsert pattern as updateBrandVoice — ghl_connections has owner-only RLS
// (auth.uid() = user_id), so this runs on the plain session-scoped client, no admin client needed.
export async function updateGhlConnection(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const locationId = String(formData.get("location_id") || "").trim();
  const apiToken = String(formData.get("api_token") || "").trim();

  if (!locationId) {
    return { error: "Location ID is required." };
  }

  // The token field is left blank on purpose once a connection already exists (see
  // GhlConnectionForm — GHL only shows it once, so we never re-display a stored token for
  // editing) — a blank submission means "keep the token I already saved," not "clear it."
  let tokenToSave = apiToken;
  if (!tokenToSave) {
    const { data: existing } = await supabase
      .from("ghl_connections")
      .select("api_token")
      .eq("user_id", user.id)
      .maybeSingle();
    tokenToSave = existing?.api_token || "";
  }
  if (!tokenToSave) {
    return { error: "A Private Integration token is required." };
  }

  const { error } = await supabase
    .from("ghl_connections")
    .upsert({ user_id: user.id, location_id: locationId, api_token: tokenToSave }, { onConflict: "user_id" });

  if (error) return { error: "Could not save your Go High Level connection. Try again." };

  revalidatePath("/settings");
  return { success: true };
}

export async function disconnectGhl() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("ghl_connections").delete().eq("user_id", user.id);
  revalidatePath("/settings");
}
