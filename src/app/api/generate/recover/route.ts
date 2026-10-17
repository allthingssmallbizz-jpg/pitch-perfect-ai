import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AssetType } from "@/types/database";

export const runtime = "nodejs";

// Reported: a laptop going to sleep mid-generation drops the browser's connection to /api/generate
// long before its response can arrive, which GenerateClient.tsx's run() used to treat as an
// outright failure. That connection dying does NOT stop the generation itself — the serverless
// function keeps running server-side, entirely independent of whether the original client
// connection is still open, right through to the same admin.from("generations").update(...) call
// that would have happened anyway (see /api/generate/route.ts) — so this is how the client checks
// whether THAT specific attempt's generation actually finished instead of assuming it didn't and
// burning a second one via Regenerate. Scoped to project + asset type + "created after this
// attempt started" rather than needing the generation's own id, since the client never received
// one if the original response never arrived either.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  const assetType = req.nextUrl.searchParams.get("assetType");
  const after = req.nextUrl.searchParams.get("after");
  if (!projectId || !assetType || !after) {
    return NextResponse.json({ error: "Missing projectId, assetType, or after" }, { status: 400 });
  }

  // RLS already scopes this to rows the requesting user owns; the explicit eq("user_id", ...)
  // just keeps that assumption visible in code rather than resting on it silently.
  const { data: generation } = await supabase
    .from("generations")
    .select("id, status, content, error")
    .eq("project_id", projectId)
    .eq("asset_type", assetType as AssetType)
    .eq("user_id", user.id)
    .gte("created_at", after)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!generation) return NextResponse.json({ status: "not_found" });
  return NextResponse.json({
    status: generation.status,
    generationId: generation.id,
    content: generation.content,
    error: generation.error,
  });
}
