import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";
import { COURSE_ASSET_TYPES } from "@/lib/ai/courseModules";

export const runtime = "nodejs";

// Agent Cora's "Completed Courses" feature — marks a generation as reviewed/approved so it moves
// out of the ordinary "Past generations" list into its own Completed section (see
// GenerateClient.tsx), labeled with the course/module it belongs to. Pure metadata — no AI call,
// no credits, nothing to regenerate. Scoped to Cora's four asset types; every other generator has
// no Completed concept (yet).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const { generation } = owned;

  if (!COURSE_ASSET_TYPES.includes(generation.asset_type)) {
    return NextResponse.json({ error: "Completed Courses isn't available for this asset type yet." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("generations").update({ approved_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not mark this as completed." }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// Moves a generation back out of Completed into the ordinary Past generations list.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const admin = createAdminClient();
  const { error } = await admin.from("generations").update({ approved_at: null }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not undo that." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
