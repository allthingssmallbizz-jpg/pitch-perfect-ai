"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Link2, ImageUp, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compressImageFile } from "@/lib/imageCompress";

const MAX_IMAGES = 3;
const PLATFORM_OPTIONS = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "other", label: "Other" },
] as const;

export type SideValue =
  | { mode: "url"; url: string }
  | {
      mode: "screenshots";
      platform: (typeof PLATFORM_OPTIONS)[number]["value"];
      images: { base64: string; mediaType: "image/jpeg" }[];
    };

// One "page to compare" input, reused for both "your page" and the "reference page" — a member
// can either paste a link (best-effort — see the API route's comment on why TikTok/Instagram/
// Facebook often expose little to nothing this way) or upload screenshots directly, which works
// regardless of what the platform lets automated tools read.
export default function SocialSideInput({
  id,
  label,
  urlPlaceholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  urlPlaceholder: string;
  value: SideValue;
  onChange: (next: SideValue) => void;
}) {
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function switchMode(mode: SideValue["mode"]) {
    if (mode === value.mode) return;
    onChange(mode === "url" ? { mode: "url", url: "" } : { mode: "screenshots", platform: "other", images: [] });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || value.mode !== "screenshots") return;
    const remaining = MAX_IMAGES - value.images.length;
    if (remaining <= 0) {
      toast.error(`Up to ${MAX_IMAGES} screenshots per page.`);
      return;
    }
    const toProcess = Array.from(files).slice(0, remaining);
    setCompressing(true);
    try {
      const compressed = await Promise.all(toProcess.map(compressImageFile));
      onChange({ ...value, images: [...value.images, ...compressed] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't process that image.");
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(index: number) {
    if (value.mode !== "screenshots") return;
    onChange({ ...value, images: value.images.filter((_, i) => i !== index) });
  }

  return (
    <div className="rounded-xl border border-border bg-card/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex overflow-hidden rounded-md border border-border text-xs">
          <button
            type="button"
            onClick={() => switchMode("url")}
            className={`flex items-center gap-1 px-2 py-1 transition-colors ${
              value.mode === "url" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Link2 className="h-3 w-3" />
            Link
          </button>
          <button
            type="button"
            onClick={() => switchMode("screenshots")}
            className={`flex items-center gap-1 border-l border-border px-2 py-1 transition-colors ${
              value.mode === "screenshots" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ImageUp className="h-3 w-3" />
            Screenshots
          </button>
        </div>
      </div>

      {value.mode === "url" ? (
        <Input
          id={id}
          placeholder={urlPlaceholder}
          value={value.url}
          onChange={(e) => onChange({ mode: "url", url: e.target.value })}
          className="mt-2"
        />
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor={`${id}-platform`} className="text-xs text-muted-foreground">
              Platform
            </Label>
            <select
              id={`${id}-platform`}
              value={value.platform}
              onChange={(e) =>
                onChange({ ...value, platform: e.target.value as (typeof PLATFORM_OPTIONS)[number]["value"] })
              }
              className="h-7 rounded-md border border-input bg-input/30 px-2 text-xs"
            >
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {value.images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {value.images.map((img, i) => (
                <div key={i} className="group relative h-16 w-16 overflow-hidden rounded-md border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local compressed base64 preview, not a static asset */}
                  <img src={`data:${img.mediaType};base64,${img.base64}`} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {value.images.length < MAX_IMAGES && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
              >
                {compressing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ImageUp className="mr-2 h-3.5 w-3.5" />}
                {compressing ? "Processing..." : `Add screenshot${value.images.length ? "" : "s"} (up to ${MAX_IMAGES})`}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
