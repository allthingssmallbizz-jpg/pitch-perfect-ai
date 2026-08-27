"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Wand2, ImagePlus, X, Loader2, Video, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { PAGE_EDIT_CREDIT_COST } from "@/lib/ai/generators/pageEdit";
import { hasVideoEmbed } from "@/lib/videoEmbed";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// The "no user-friendly way to change the page once it's built" gap — a plain-language request
// box ("change the headline to X," "add a testimonial section," "make the CTA orange") plus an
// optional photo upload, sent to a dedicated targeted-edit AI call (see
// /api/generations/[id]/edit) that touches only what was asked and returns the whole updated
// page. The image itself is uploaded straight to Supabase Storage from the browser (same
// pattern Agent Addie's Image Ads already uses) rather than round-tripping through our own
// server — the edit call then just gets a real, permanent URL to place in the page.
//
// The video link field is handled differently on purpose: it's a plain, deterministic
// insert-or-replace (see videoEmbed.ts), never an AI call — pasting a new link always replaces
// the existing video instead of stacking another one on top of it, and it's free.
export default function PageEditPanel({
  generationId,
  content,
  onApplied,
}: {
  generationId: string;
  content: string;
  onApplied: (newContent: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [applying, setApplying] = useState(false);
  const [removingVideo, setRemovingVideo] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoAlreadyOnPage = hasVideoEmbed(content);

  function pickImage(file: File | null) {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    if (!file) {
      setImageFile(null);
      setImagePreviewUrl(null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image is too large (8MB max).");
      return;
    }
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  async function handleApply() {
    if (!instruction.trim() && !imageFile && !videoUrl.trim()) {
      toast.error("Describe a change, attach a photo, or paste a video link first.");
      return;
    }
    setApplying(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        setStatusLabel("Uploading image...");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not signed in.");

        const extension = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${generationId}/${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("page-images")
          .upload(path, imageFile, { contentType: imageFile.type || "image/jpeg" });
        if (uploadError) throw new Error(`Could not upload image: ${uploadError.message}`);

        const { data: publicUrlData } = supabase.storage.from("page-images").getPublicUrl(path);
        imageUrl = publicUrlData.publicUrl;
      }

      setStatusLabel("Applying update...");
      const res = await fetch(`/api/generations/${generationId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, imageUrl, videoUrl: videoUrl.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not apply that update.");

      onApplied(data.content);
      setInstruction("");
      setVideoUrl("");
      pickImage(null);
      toast.success("Updated!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply that update.");
    } finally {
      setApplying(false);
      setStatusLabel(null);
    }
  }

  async function handleRemoveVideo() {
    setRemovingVideo(true);
    try {
      const res = await fetch(`/api/generations/${generationId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeVideo: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not remove the video.");
      onApplied(data.content);
      toast.success("Video removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the video.");
    } finally {
      setRemovingVideo(false);
    }
  }

  const isVideoOnlyRequest = !instruction.trim() && !imageFile && videoUrl.trim().length > 0;

  return (
    <div className="card-elevated rounded-xl p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <Wand2 className="h-4 w-4" />
        Ask for an update
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Describe exactly what you want changed — a headline, a section, a color, adding a photo —
        and it&apos;ll be applied to the page above. Everything else stays exactly as it is.
      </p>
      <Textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder={`e.g. "Change the headline to 'Book Your Free Strategy Call'" or "Add a short testimonial section after the benefits" or "Make the CTA button bigger and use the accent color"`}
        rows={3}
        disabled={applying}
      />
      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="block text-xs text-muted-foreground">Video link (optional)</label>
          {videoAlreadyOnPage && (
            <button
              type="button"
              onClick={handleRemoveVideo}
              disabled={removingVideo || applying}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              {removingVideo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Remove current video
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
            disabled={applying}
            className="flex-1"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Works with YouTube, Vimeo, or a direct video file link (.mp4/.webm/.mov) — added near the
          bottom of the page, above the footer. Pasting a new link always replaces the current
          video rather than adding another one. Note: it won&apos;t play inside this in-app Preview
          tab (a safety sandbox) — use <strong>Preview in browser</strong> or check the published
          live page to see it actually play.
        </p>
      </div>
      {imagePreviewUrl && (
        <div className="mt-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a remote image */}
          <img src={imagePreviewUrl} alt="Upload preview" className="h-12 w-12 rounded-md object-cover" />
          <span className="truncate text-xs text-muted-foreground">{imageFile?.name}</span>
          <button
            type="button"
            onClick={() => pickImage(null)}
            disabled={applying}
            className="text-muted-foreground hover:text-destructive"
            title="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={applying}>
          <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
          {imageFile ? "Change photo" : "Add a photo"}
        </Button>
        <Button type="button" size="sm" className="ml-auto" onClick={handleApply} disabled={applying}>
          {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          {applying
            ? statusLabel || "Working..."
            : isVideoOnlyRequest
              ? "Apply update (free)"
              : `Apply update (${PAGE_EDIT_CREDIT_COST} credits)`}
        </Button>
      </div>
    </div>
  );
}
