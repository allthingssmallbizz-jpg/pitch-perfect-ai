import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";

export const runtime = "nodejs";

const requestSchema = z.object({ content: z.string() });

// Debounced background save while the user is typing in the rich text editor — persists so
// work isn't lost on a refresh/crash, but deliberately does NOT write a version_history row.
// Only an explicit "Save" (see ../save/route.ts) or a fresh generation snapshots a version;
// otherwise every keystroke pause would flood the version list.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("generations").update({ content: parsed.data.content }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
