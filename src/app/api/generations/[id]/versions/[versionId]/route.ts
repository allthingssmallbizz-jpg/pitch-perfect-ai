import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const admin = createAdminClient();
  const { error } = await admin
    .from("generation_versions")
    .delete()
    .eq("id", versionId)
    .eq("generation_id", id);
  if (error) return NextResponse.json({ error: "Could not delete." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
