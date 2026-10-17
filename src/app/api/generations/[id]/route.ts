import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";

export const runtime = "nodejs";

// Lets a member name a past generation (e.g. "Book a Call version", "Tripwire version") so
// running the same asset multiple times with a different offer/link to A/B test doesn't mean
// hunting through timestamps and preview snippets to find the right one — see
// 0049_generation_title.sql. An empty/blank title clears it back to null rather than storing "".
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const body = await req.json().catch(() => null);
  const rawTitle = typeof body?.title === "string" ? body.title : "";
  const title = rawTitle.trim().slice(0, 200) || null;

  const admin = createAdminClient();
  const { error } = await admin.from("generations").update({ title }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not rename." }, { status: 500 });

  return NextResponse.json({ ok: true, title });
}

// Deletes an entire past generation — not just one saved version (see
// .../versions/[versionId] for that). generation_versions cascade-deletes with it (FK
// `on delete cascade`, 0006_generation_versions.sql), so no separate cleanup is needed.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  // generations has no owner-DELETE RLS policy (service-role only, by design — see
  // getOwnedGeneration's comment), so the actual delete goes through the admin client after
  // getOwnedGeneration has already confirmed this user owns it.
  const admin = createAdminClient();
  const { error } = await admin.from("generations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
