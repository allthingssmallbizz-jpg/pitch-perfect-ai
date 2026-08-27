import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";

export const runtime = "nodejs";

// Takes a page offline without forgetting its slug — publish_slug is left in place so republishing
// later (e.g. after a color edit) brings the exact same link back to life instead of generating a
// new one and breaking anything already shared.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const admin = createAdminClient();
  const { error } = await admin.from("generations").update({ published_at: null }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not unpublish." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
