import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";

export const runtime = "nodejs";

// Restoring is itself undoable: the current content is snapshotted as a 'snapshot' version
// before being overwritten, then the generation's content is set to the target version.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const admin = createAdminClient();

  const { data: version } = await admin
    .from("generation_versions")
    .select("content")
    .eq("id", versionId)
    .eq("generation_id", id)
    .single();
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  const currentContent = owned.generation.content ?? "";
  if (currentContent.trim() && currentContent !== version.content) {
    await admin.from("generation_versions").insert({
      generation_id: id,
      user_id: owned.userId,
      content: currentContent,
      source: "snapshot",
      label: "Before restore",
    });
  }

  const { error } = await admin.from("generations").update({ content: version.content }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not restore." }, { status: 500 });

  return NextResponse.json({ ok: true, content: version.content });
}
