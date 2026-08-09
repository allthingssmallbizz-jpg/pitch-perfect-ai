"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Sparkles, Download, Save, Loader2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DeleteGenerationButton from "@/components/DeleteGenerationButton";

export type AdImageCopy = { headline: string; subheadline: string; cta: string };
export type PastAdImage = { id: string; createdAt: string; copy: AdImageCopy; thumbnailUrl: string | null };

const CANVAS_SIZE = 1080;
const EXT_BY_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function formatWhen(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text.trim()) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const imgRatio = img.width / img.height;
  let sx: number, sy: number, sw: number, sh: number;
  if (imgRatio > 1) {
    sh = img.height;
    sw = sh;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

// The whole point of doing this client-side with plain canvas drawing instead of an AI image
// model: current image-gen models can't reliably render legible, accurate text, which would
// make headlines/CTAs a coin-flip on something a member is paying for. This composites the
// same three AI-written strings (headline/subheadline/cta) onto their photo deterministically.
function renderAdCanvas(canvas: HTMLCanvasElement, img: HTMLImageElement, copy: AdImageCopy) {
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  drawCover(ctx, img);

  const gradStart = CANVAS_SIZE * 0.4;
  const gradient = ctx.createLinearGradient(0, gradStart, 0, CANVAS_SIZE);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, gradStart, CANVAS_SIZE, CANVAS_SIZE - gradStart);

  const paddingX = 64;
  const maxTextWidth = CANVAS_SIZE - paddingX * 2;
  const centerX = CANVAS_SIZE / 2;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 12;

  // CTA pill, anchored near the bottom.
  const pillH = 68;
  const pillBottom = CANVAS_SIZE - 56;
  const pillTop = pillBottom - pillH;
  ctx.font = "700 32px system-ui, -apple-system, Segoe UI, sans-serif";
  const ctaText = (copy.cta || "Learn More").toUpperCase();
  const ctaWidth = Math.min(maxTextWidth, ctx.measureText(ctaText).width + 80);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  const pillLeft = centerX - ctaWidth / 2;
  const radius = pillH / 2;
  ctx.beginPath();
  ctx.moveTo(pillLeft + radius, pillTop);
  ctx.arcTo(pillLeft + ctaWidth, pillTop, pillLeft + ctaWidth, pillTop + pillH, radius);
  ctx.arcTo(pillLeft + ctaWidth, pillTop + pillH, pillLeft, pillTop + pillH, radius);
  ctx.arcTo(pillLeft, pillTop + pillH, pillLeft, pillTop, radius);
  ctx.arcTo(pillLeft, pillTop, pillLeft + ctaWidth, pillTop, radius);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#111111";
  ctx.textBaseline = "middle";
  ctx.fillText(ctaText, centerX, pillTop + pillH / 2 + 2);

  // Subheadline, stacked just above the pill.
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#f1f1f1";
  ctx.font = "500 34px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textBaseline = "alphabetic";
  const subLines = wrapText(ctx, copy.subheadline, maxTextWidth).slice(0, 2);
  const subLineHeight = 44;
  let cursorY = pillTop - 32;
  for (let i = subLines.length - 1; i >= 0; i--) {
    ctx.fillText(subLines[i], centerX, cursorY);
    cursorY -= subLineHeight;
  }

  // Headline, stacked above the subheadline.
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 60px system-ui, -apple-system, Segoe UI, sans-serif";
  const headlineLines = wrapText(ctx, copy.headline, maxTextWidth).slice(0, 2);
  const headlineLineHeight = 70;
  cursorY -= 12;
  for (let i = headlineLines.length - 1; i >= 0; i--) {
    ctx.fillText(headlineLines[i], centerX, cursorY);
    cursorY -= headlineLineHeight;
  }

  ctx.shadowBlur = 0;
}

export default function AdImageClient({
  projectId,
  initial,
  initialPastGenerations,
}: {
  projectId: string;
  initial: PastAdImage | null;
  initialPastGenerations: PastAdImage[];
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);

  const [viewingId, setViewingId] = useState<string | null>(initial?.id ?? null);
  const [viewingUrl, setViewingUrl] = useState<string | null>(initial?.thumbnailUrl ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [copy, setCopy] = useState<AdImageCopy>(initial?.copy ?? { headline: "", subheadline: "", cta: "" });
  const [generationId, setGenerationId] = useState<string | null>(initial?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pastGenerations, setPastGenerations] = useState<PastAdImage[]>(initialPastGenerations);

  // No effect syncing state from `initial` on change — the parent page remounts this
  // component (key={generationId ?? "new"}) whenever which generation is being viewed
  // changes, so these useState initializers re-run fresh instead.

  // Re-render the live canvas preview whenever the photo or copy text changes — including
  // manual edits after generation, so tweaking a headline updates the preview instantly.
  useEffect(() => {
    if (!photoUrl || viewingId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      imgElRef.current = img;
      renderAdCanvas(canvas, img, copy);
    };
    img.src = photoUrl;
  }, [photoUrl, copy, viewingId]);

  function startNew() {
    setViewingId(null);
    setViewingUrl(null);
    setGenerationId(null);
    setCopy({ headline: "", subheadline: "", cta: "" });
    setPhotoFile(null);
    setPhotoUrl(null);
    router.replace(`/projects/${projectId}/ad-image`);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setPhotoFile(file);
    setPhotoUrl(URL.createObjectURL(file));
    setGenerationId(null);
  }

  async function canvasToBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvasRef.current?.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not render image."))), "image/png");
    });
  }

  async function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load photo."));
      img.src = url;
    });
  }

  async function handleGenerate() {
    if (!photoFile) {
      toast.error("Upload a photo first.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();

      const startRes = await fetch("/api/agents/ad-image/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || "Could not start.");

      const ext = EXT_BY_MIME[photoFile.type] || "jpg";
      const sourcePath = `${startData.path}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(startData.bucket)
        .upload(sourcePath, photoFile, { contentType: photoFile.type || "image/jpeg" });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const genRes = await fetch(`/api/agents/ad-image/${startData.generationId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error || "Generation failed.");

      setCopy(genData.copy);
      setGenerationId(startData.generationId);

      // Composite + persist the result immediately (not on a later effect tick, and not
      // relying on whatever the live-preview effect happened to draw already) so the finished
      // image is never a click away from disappearing — load the photo explicitly here rather
      // than trusting imgElRef to already be populated from the earlier preview effect.
      const img = await loadImage(photoUrl!);
      imgElRef.current = img;
      const canvas = canvasRef.current!;
      renderAdCanvas(canvas, img, genData.copy);

      const blob = await canvasToBlob();
      const resultPath = `${startData.path.replace(/\/source$/, "/result.png")}`;
      const { error: resultUploadError } = await supabase.storage
        .from("ad-images")
        .upload(resultPath, blob, { contentType: "image/png", upsert: true });
      if (resultUploadError) throw new Error(`Could not save the finished image: ${resultUploadError.message}`);

      await fetch(`/api/agents/ad-image/${startData.generationId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: resultPath }),
      });

      const dataUrl = canvas!.toDataURL("image/png");
      setPastGenerations((prev) => [
        { id: startData.generationId, createdAt: new Date().toISOString(), copy: genData.copy, thumbnailUrl: dataUrl },
        ...prev,
      ]);
      toast.success("Ad created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEdits() {
    if (!generationId || !canvasRef.current) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const blob = await canvasToBlob();
      const path = `${(await supabase.auth.getUser()).data.user?.id}/${generationId}/result.png`;
      const { error: uploadError } = await supabase.storage
        .from("ad-images")
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const res = await fetch(`/api/agents/ad-image/${generationId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) throw new Error("Could not save.");

      setPastGenerations((prev) =>
        prev.map((g) => (g.id === generationId ? { ...g, copy, thumbnailUrl: canvasRef.current!.toDataURL("image/png") } : g))
      );
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "ad.png";
    a.click();
  }

  function openPast(g: PastAdImage) {
    router.push(`/projects/${projectId}/ad-image?generationId=${g.id}`);
  }

  const isViewing = !!viewingId;

  return (
    <div>
      {isViewing ? (
        <div className="card-elevated rounded-2xl p-6">
          {viewingUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a signed Supabase Storage URL / data URL, not a static asset
            <img src={viewingUrl} alt="Ad preview" className="mx-auto mb-4 max-w-md rounded-xl border border-border" />
          )}
          <div className="mb-4 grid gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Headline: </span>
              {copy.headline}
            </div>
            <div>
              <span className="text-muted-foreground">Subheadline: </span>
              {copy.subheadline}
            </div>
            <div>
              <span className="text-muted-foreground">CTA: </span>
              {copy.cta}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={viewingUrl ?? "#"} download="ad.png">
                <Download className="mr-1.5 h-4 w-4" /> Download
              </a>
            </Button>
            <Button size="sm" onClick={startNew}>
              <Plus className="mr-1.5 h-4 w-4" /> Create another
            </Button>
          </div>
        </div>
      ) : (
        <div className="card-elevated rounded-2xl p-6">
          <div className="mb-4">
            <Label htmlFor="ad-photo">Photo</Label>
            <div className="mt-1.5">
              <label
                htmlFor="ad-photo"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/30 px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary/40"
              >
                <Upload className="h-4 w-4" />
                {photoFile ? photoFile.name : "Upload a photo of yourself or your product"}
              </label>
              <input id="ad-photo" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            </div>
          </div>

          {photoUrl && (
            <div className="mb-4 flex justify-center">
              <canvas ref={canvasRef} className="w-full max-w-md rounded-xl border border-border" />
            </div>
          )}

          {photoUrl && (
            <div className="mb-4 grid gap-3">
              <div>
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  value={copy.headline}
                  maxLength={60}
                  onChange={(e) => setCopy((c) => ({ ...c, headline: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="subheadline">Subheadline</Label>
                <Input
                  id="subheadline"
                  value={copy.subheadline}
                  maxLength={110}
                  onChange={(e) => setCopy((c) => ({ ...c, subheadline: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="cta">CTA</Label>
                <Input
                  id="cta"
                  value={copy.cta}
                  maxLength={30}
                  onChange={(e) => setCopy((c) => ({ ...c, cta: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!generationId ? (
              <Button onClick={handleGenerate} disabled={loading || !photoFile}>
                {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                {loading ? "Generating..." : "Generate ad"}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleSaveEdits} disabled={saving}>
                  {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                  {saving ? "Saving..." : "Save changes"}
                </Button>
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="mr-1.5 h-4 w-4" /> Download
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {pastGenerations.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Past image ads from this agent ({pastGenerations.length})
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {pastGenerations.map((g) => (
              <div key={g.id} className="card-elevated overflow-hidden rounded-xl">
                <button onClick={() => openPast(g)} className="block w-full">
                  {g.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a signed Supabase Storage URL / data URL
                    <img src={g.thumbnailUrl} alt={g.copy.headline || "Ad"} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-card/40 text-xs text-muted-foreground">
                      No preview
                    </div>
                  )}
                </button>
                <div className="flex items-center justify-between gap-1 p-2">
                  <span className="truncate text-xs text-muted-foreground">{formatWhen(g.createdAt)}</span>
                  <DeleteGenerationButton generationId={g.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
