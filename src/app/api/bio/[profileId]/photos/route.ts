import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_PRESENTER_PHOTOS } from "@/lib/presenterPhotos";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

async function getOwnedProfile(profileId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", status: 401 } as const;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("presenter_bio_profiles")
    .select("id, user_id, presenter_photos")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile || profile.user_id !== user.id) return { error: "Bio not found", status: 404 } as const;
  return { userId: user.id, admin, photos: profile.presenter_photos ?? [] };
}

// Uploads one presenter photo (family, a candid shot) for the meet-the-presenter slide. The
// browser downsizes it to a JPEG before sending (see PresenterPhotos.tsx) so a full-resolution
// phone photo stays well under the hosting platform's request-body limit and keeps the exported
// .pptx a reasonable size.
export async function POST(req: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const owned = await getOwnedProfile(profileId);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const { userId, admin, photos } = owned;

  if (photos.length >= MAX_PRESENTER_PHOTOS) {
    return NextResponse.json({ error: `You can upload up to ${MAX_PRESENTER_PHOTOS} photos. Remove one first.` }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo received." }, { status: 400 });
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Please upload a JPG or PNG photo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That photo is too large (8MB max)." }, { status: 400 });

  const path = `${userId}/${profileId}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("presenter-photos")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (uploadError) return NextResponse.json({ error: "Could not save that photo." }, { status: 500 });

  const next = [...photos, path];
  const { error } = await admin.from("presenter_bio_profiles").update({ presenter_photos: next }).eq("id", profileId);
  if (error) {
    await admin.storage.from("presenter-photos").remove([path]);
    return NextResponse.json({ error: "Could not save that photo." }, { status: 500 });
  }

  const { data: signed } = await admin.storage.from("presenter-photos").createSignedUrl(path, 3600);
  return NextResponse.json({ path, url: signed?.signedUrl ?? null });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const owned = await getOwnedProfile(profileId);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const { admin, photos } = owned;

  const path = req.nextUrl.searchParams.get("path");
  if (!path || !photos.includes(path)) return NextResponse.json({ error: "Photo not found." }, { status: 404 });

  const { error } = await admin
    .from("presenter_bio_profiles")
    .update({ presenter_photos: photos.filter((p) => p !== path) })
    .eq("id", profileId);
  if (error) return NextResponse.json({ error: "Could not remove that photo." }, { status: 500 });
  await admin.storage.from("presenter-photos").remove([path]);

  return NextResponse.json({ ok: true });
}
