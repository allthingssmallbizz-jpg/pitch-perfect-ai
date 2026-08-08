import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";

export const runtime = "nodejs";

const requestSchema = z.object({ winners: z.array(z.string()) });

// Persists Headline Lab's winner picks so they survive a refresh / reload via
// ?generationId=... — see supabase/migrations/0008_headline_winners.sql.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  if (owned.generation.asset_type !== "headline_lab") {
    return NextResponse.json({ error: "Not a headline set" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("generations").update({ winners: parsed.data.winners }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
