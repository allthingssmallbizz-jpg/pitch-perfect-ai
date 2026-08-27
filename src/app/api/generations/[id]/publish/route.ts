import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";
import { WEB_PAGE_ASSET_TYPES } from "@/lib/ai/generators/htmlPage";
import { generateUniqueSlug, getPublicSiteUrl } from "@/lib/publishing";

export const runtime = "nodejs";

// Makes a generated Landing Page or Thank You Page live at {NEXT_PUBLIC_APP_URL}/site/{slug} —
// no external hosting account, no DNS. The slug is generated once (seeded from the project name)
// and then reused on every later publish, so a link a member has already shared never breaks.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const { generation } = owned;
  if (!WEB_PAGE_ASSET_TYPES.includes(generation.asset_type)) {
    return NextResponse.json({ error: "Only Landing Pages and Thank You Pages can be published." }, { status: 400 });
  }
  if (!generation.content?.trim()) {
    return NextResponse.json({ error: "Nothing generated yet." }, { status: 400 });
  }

  const admin = createAdminClient();

  let slug = generation.publish_slug;
  if (!slug) {
    const { data: project } = await admin
      .from("projects")
      .select("name")
      .eq("id", generation.project_id ?? "")
      .maybeSingle();
    slug = await generateUniqueSlug(admin, project?.name || "page");
  }

  const { error } = await admin
    .from("generations")
    .update({ publish_slug: slug, published_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "Could not publish." }, { status: 500 });

  return NextResponse.json({ slug, url: getPublicSiteUrl(slug) });
}
