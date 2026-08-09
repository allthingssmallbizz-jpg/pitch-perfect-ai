import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";

export const runtime = "nodejs";

const requestSchema = z.object({ path: z.string().min(1) });

// Step 3: after compositing the photo + copy into a finished ad image client-side, the browser
// uploads that PNG directly to Storage, then calls this to record where it landed —
// persisted immediately (not behind a manual "Save" click) so the finished creative is never
// lost the way plain-text generations were before past-generations tracking existed.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("generations").update({ image_result_path: parsed.data.path }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
