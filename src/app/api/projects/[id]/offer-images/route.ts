import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

async function getOwnedProject(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", status: 401 } as const;
  const admin = createAdminClient();
  const { data: project } = await admin.from("projects").select("id, user_id").eq("id", projectId).maybeSingle();
  if (!project || project.user_id !== user.id) return { error: "Project not found", status: 404 } as const;
  return { userId: user.id, admin };
}

// Uploads a product image for one stack item / bonus / fast action bonus in Discovery. Stored in
// the existing slide-images bucket (the same per-user-folder bucket slide images already use), so
// no new bucket is needed. The path is only returned here — it's saved onto the item itself when
// the Discovery form is saved (see parseStackItems), same as every other Discovery field.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedProject(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const { userId, admin } = owned;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No image received." }, { status: 400 });
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Please upload a JPG or PNG image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That image is too large (8MB max)." }, { status: 400 });

  const path = `${userId}/offer-items/${id}/${randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from("slide-images")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (error) return NextResponse.json({ error: "Could not save that image." }, { status: 500 });

  const { data: signed } = await admin.storage.from("slide-images").createSignedUrl(path, 3600);
  return NextResponse.json({ path, url: signed?.signedUrl ?? null });
}

// Signed preview URLs for this project's item images (the bucket is private), so the Discovery
// form can show thumbnails for images saved in an earlier session.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedProject(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const { userId, admin } = owned;

  // Any of this member's own item images, not just this project's — a duplicated project's items
  // still point at the original project's files.
  const prefix = `${userId}/offer-items/`;
  const paths = req.nextUrl.searchParams.getAll("path").filter((p) => p.startsWith(prefix));
  if (paths.length === 0) return NextResponse.json({ urls: {} });

  const { data: signed } = await admin.storage.from("slide-images").createSignedUrls(paths, 3600);
  const urls: Record<string, string> = {};
  for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  return NextResponse.json({ urls });
}
