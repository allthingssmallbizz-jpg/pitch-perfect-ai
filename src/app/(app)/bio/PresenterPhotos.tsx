"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { MAX_PRESENTER_PHOTOS } from "@/lib/presenterPhotos";
import { downsizeToJpeg } from "@/lib/imageResize";

type Photo = { path: string; url: string | null };

export default function PresenterPhotos({ profileId, initialPhotos }: { profileId: string; initialPhotos: Photo[] }) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const jpeg = await downsizeToJpeg(file);
      const body = new FormData();
      body.append("file", new File([jpeg], "photo.jpg", { type: "image/jpeg" }));
      const res = await fetch(`/api/bio/${profileId}/photos`, { method: "POST", body });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not upload that photo.");
      setPhotos((prev) => [...prev, { path: data.path, url: data.url }]);
      toast.success("Photo added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload that photo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(path: string) {
    if (!window.confirm("Remove this photo? Slides that already use it keep their copy.")) return;
    setRemoving(path);
    try {
      const res = await fetch(`/api/bio/${profileId}/photos?path=${encodeURIComponent(path)}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not remove that photo.");
      setPhotos((prev) => prev.filter((p) => p.path !== path));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove that photo.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div>
      <Label>Your photos (family, a candid shot)</Label>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Up to {MAX_PRESENTER_PHOTOS} real photos. Once your webinar deck is built, use &quot;Add image&quot; on any
        slide (usually your meet-the-presenter slide) to place one there — it shows in the preview and the PowerPoint
        download. Photos save as soon as you add them.
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        {photos.map((photo) => (
          <div key={photo.path} className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-card">
            {photo.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not a static asset
              <img src={photo.url} alt="Presenter photo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Photo</div>
            )}
            <button
              type="button"
              onClick={() => remove(photo.path)}
              disabled={removing === photo.path}
              className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black"
              title="Remove photo"
            >
              {removing === photo.path ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            </button>
          </div>
        ))}
        {photos.length < MAX_PRESENTER_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            {uploading ? "Uploading…" : "Add photo"}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
