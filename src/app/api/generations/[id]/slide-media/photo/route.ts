import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedGeneration } from "@/lib/generations";
import { parsePptOutline, classifySlideLayout } from "@/lib/ai/pptxParser";
import { PRESENTER_PHOTO_LABEL } from "@/lib/presenterPhotos";
import type { AssetType } from "@/types/database";

export const runtime = "nodejs";

const PHOTO_ASSET_TYPES: AssetType[] = ["ppt_outline", "course_module_slides", "challenge_day_slides"];

const requestSchema = z.object({
  slideNumber: z.number().int().positive(),
  photoPath: z.string().min(1).max(500),
});

// Places one of the member's own presenter photos (uploaded on their Bio page) onto a slide —
// typically the meet-the-presenter slide. Copies the file into the slide-images bucket and
// records it as an ordinary slide_media image, so the existing preview, the remove button, and
// the .pptx export all handle it with no special cases. A copy (not a reference) means deleting
// the photo from the Bio later never breaks a deck that already uses it. No credits — no AI call.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedGeneration(id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const { userId, generation } = owned;

  if (!PHOTO_ASSET_TYPES.includes(generation.asset_type)) {
    return NextResponse.json({ error: "Photos can only be added to a slide deck." }, { status: 400 });
  }
  if (!generation.content?.trim()) return NextResponse.json({ error: "Nothing generated yet." }, { status: 400 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { slideNumber, photoPath } = parsed.data;

  const slides = parsePptOutline(generation.content);
  const slideIndex = slides.findIndex((s) => s.number === slideNumber);
  if (slideIndex === -1) return NextResponse.json({ error: "Couldn't find that slide." }, { status: 404 });
  if (classifySlideLayout(slideIndex, slides.length, slides[slideIndex].title) !== "content") {
    return NextResponse.json(
      { error: "Photos can only be added to a regular content slide, not the title, section, or closing slide." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: owningBio } = await admin
    .from("presenter_bio_profiles")
    .select("id")
    .eq("user_id", userId)
    .contains("presenter_photos", [photoPath])
    .limit(1)
    .maybeSingle();
  if (!owningBio) return NextResponse.json({ error: "That photo isn't on your Bio anymore." }, { status: 404 });

  const { data: file, error: downloadError } = await admin.storage.from("presenter-photos").download(photoPath);
  if (downloadError || !file) return NextResponse.json({ error: "Could not load that photo." }, { status: 500 });

  const isPng = photoPath.toLowerCase().endsWith(".png");
  const storagePath = `${userId}/${id}/${slideNumber}.${isPng ? "png" : "jpg"}`;
  const { error: uploadError } = await admin.storage
    .from("slide-images")
    .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: isPng ? "image/png" : "image/jpeg",
      upsert: true,
    });
  if (uploadError) return NextResponse.json({ error: "Could not add that photo." }, { status: 500 });

  const { error: upsertError } = await admin.from("slide_media").upsert(
    {
      generation_id: id,
      user_id: userId,
      slide_number: slideNumber,
      kind: "image",
      storage_path: storagePath,
      chart_type: null,
      chart_data: null,
      prompt: PRESENTER_PHOTO_LABEL,
    },
    { onConflict: "generation_id,slide_number" }
  );
  if (upsertError) return NextResponse.json({ error: "Could not add that photo." }, { status: 500 });

  const { data: signed } = await admin.storage.from("slide-images").createSignedUrl(storagePath, 3600);
  return NextResponse.json({ slideNumber, kind: "image", url: signed?.signedUrl ?? null });
}
