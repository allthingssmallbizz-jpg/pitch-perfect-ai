"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateDisplayName(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get("full_name") || "").trim();
  if (!fullName) {
    return { error: "Display name can't be empty." };
  }
  if (fullName.length > 100) {
    return { error: "Keep it under 100 characters." };
  }

  // Upsert via the admin client rather than a plain owner-scoped UPDATE: if this account's
  // profiles row is missing for any reason (see src/lib/profile.ts), an UPDATE against a
  // nonexistent row matches zero rows and reports success with nothing actually saved — this
  // creates the row if needed instead of silently no-op'ing. onConflict on id means an
  // existing row only has full_name/email touched; every other column is left alone.
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .upsert({ id: user.id, email: user.email ?? "", full_name: fullName }, { onConflict: "id" });
  if (error) {
    return { error: "Could not save. Try again." };
  }

  // "layout" (not the default "page") revalidates the shared (app) layout that renders
  // AppSidebar — otherwise the sidebar's display name (server-fetched in that layout) wouldn't
  // pick up the change until some unrelated full reload happened to re-run it.
  revalidatePath("/settings", "layout");
  return { success: true };
}
