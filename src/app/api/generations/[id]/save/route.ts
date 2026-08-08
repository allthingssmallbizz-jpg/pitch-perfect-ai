import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";

export const runtime = "nodejs";

const requestSchema = z.object({ content: z.string() });

// Explicit "Save" from the editor toolbar — unlike autosave, this snapshots a version row
// (source='edit') so the version history has a meaningful, user-intended checkpoint to restore
// to, distinct from the constant background autosave.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const content = parsed.data.content;
  if (!content.trim()) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error: updateError } = await admin.from("generations").update({ content }).eq("id", id);
  if (updateError) return NextResponse.json({ error: "Could not save." }, { status: 500 });

  const { error: versionError } = await admin.from("generation_versions").insert({
    generation_id: id,
    user_id: owned.userId,
    content,
    source: "edit",
    label: "Manual edit",
  });
  if (versionError) return NextResponse.json({ error: "Saved, but couldn't record version history." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
