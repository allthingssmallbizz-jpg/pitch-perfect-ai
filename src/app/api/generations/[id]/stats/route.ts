import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";
import { getPageStats } from "@/lib/analytics";

export const runtime = "nodejs";

// On-demand refresh for the views/leads/conversion badges in GenerateClient's PublishPanel — the
// initial numbers come from the server component on page load, this just lets someone check
// again without a full page refresh after sharing the link.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const admin = createAdminClient();
  const stats = await getPageStats(admin, id);
  return NextResponse.json(stats);
}
