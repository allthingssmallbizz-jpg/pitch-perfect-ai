import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";

export const runtime = "nodejs";

// Lists every image/chart a member has added to this deck's slides (see slide-media/image and
// slide-media/chart for how a row gets created). Images live in the private slide-images bucket,
// so a signed URL is computed fresh on every read rather than stored — it expires in an hour,
// same tradeoff the ad-images bucket already makes (see agents/[assetType]/page.tsx).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("slide_media")
    .select("slide_number, kind, storage_path, chart_type, chart_data, prompt")
    .eq("generation_id", id);

  const imagePaths = (rows ?? [])
    .filter((r) => r.kind === "image" && r.storage_path)
    .map((r) => r.storage_path as string);
  const signedByPath = new Map<string, string>();
  if (imagePaths.length > 0) {
    const { data: signed } = await admin.storage.from("slide-images").createSignedUrls(imagePaths, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl);
    }
  }

  const media = (rows ?? []).map((r) => ({
    slideNumber: r.slide_number,
    kind: r.kind,
    url: r.kind === "image" && r.storage_path ? (signedByPath.get(r.storage_path) ?? null) : null,
    chartType: r.chart_type,
    chartData: r.chart_data,
    prompt: r.prompt,
  }));

  return NextResponse.json({ media });
}

// Removes one slide's image or chart, reverting it back to a plain text slide. Best-effort
// storage cleanup for images — the DB row is the source of truth either way.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const slideNumberParam = req.nextUrl.searchParams.get("slideNumber");
  const slideNumber = slideNumberParam ? Number(slideNumberParam) : NaN;
  if (!Number.isInteger(slideNumber)) {
    return NextResponse.json({ error: "Missing or invalid slideNumber." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("slide_media")
    .select("kind, storage_path")
    .eq("generation_id", id)
    .eq("slide_number", slideNumber)
    .maybeSingle();

  if (existing?.kind === "image" && existing.storage_path) {
    await admin.storage.from("slide-images").remove([existing.storage_path]);
  }

  const { error } = await admin.from("slide_media").delete().eq("generation_id", id).eq("slide_number", slideNumber);
  if (error) return NextResponse.json({ error: "Could not remove that." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
