"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, BarChart3, Loader2, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parsePptOutline, classifySlideLayout } from "@/lib/ai/pptxParser";
import { SLIDE_IMAGE_CREDIT_COST, SLIDE_CHART_TYPES, SLIDE_CHART_MAX_POINTS } from "@/lib/ai/generators/slideMedia";
import type { SlideChartType } from "@/types/database";

type SlideMediaItem = {
  slideNumber: number;
  kind: "image" | "chart";
  url: string | null;
  chartType: SlideChartType | null;
  chartData: { labels: string[]; values: number[] } | null;
  prompt: string | null;
};

// A simple, honest preview — not a pixel-perfect match to the real chart pptxgenjs renders in
// the export (see pptxDeckBuilder.ts's addChart) — just enough to show the data landed right and
// which slide it's attached to.
function MiniChart({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  return (
    <div className="space-y-1.5">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-2 text-[11px] text-white/90">
          <span className="w-16 shrink-0 truncate" title={label}>
            {label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white/70" style={{ width: `${(Math.abs(values[i]) / max) * 100}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right text-white/60">{values[i]}</span>
        </div>
      ))}
    </div>
  );
}

// One line per data point, "Label, Value" — the simplest input shape that still lets someone
// type a whole chart in a single textarea instead of a row of separate fields per point.
function parseChartDraftText(text: string): { labels: string[]; values: number[] } | null {
  const labels: string[] = [];
  const values: number[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const lastComma = line.lastIndexOf(",");
    if (lastComma === -1) continue;
    const label = line.slice(0, lastComma).trim();
    const value = Number(line.slice(lastComma + 1).trim());
    if (!label || !Number.isFinite(value)) continue;
    labels.push(label);
    values.push(value);
  }
  if (labels.length < 2) return null;
  return { labels: labels.slice(0, SLIDE_CHART_MAX_POINTS), values: values.slice(0, SLIDE_CHART_MAX_POINTS) };
}

type ChartDraft = { chartType: SlideChartType; title: string; text: string };

// A visual "can I actually see the deck" view for Your Signature Webinar (ppt_outline) and Cora's
// Build Module Slides (course_module_slides) — both generators already write in the exact
// "Slide #: Title / On-slide content / Speaker notes" markdown that parsePptOutline (and the real
// .pptx export) already parse, so this reuses that same parser rather than inventing a second
// format to keep in sync. This is a layout preview, not the designed file itself — no fixed
// slide aspect ratio or bullet truncation, since a slide with more content than usual should still
// show all of it here rather than silently cropping it.
//
// mediaEnabled gates the per-slide "Generate image" / "Add chart" controls — v1 only supports
// these on Build Module Slides decks (see SLIDE_MEDIA_ASSET_TYPES), not Your Signature Webinar's
// much longer 60-90 slide decks, where a real per-image OpenAI cost compounds fast.
export default function SlidePreview({
  markdown,
  generationId,
  mediaEnabled,
  scriptBySlideNumber,
}: {
  markdown: string;
  generationId: string | null;
  mediaEnabled: boolean;
  // ppt_outline only — when a full Webinar Script exists for this project, its per-slide text
  // stands in for the deck's own short speaker notes here, matching what the .pptx export and
  // Copy for Gamma also show. Null for every other asset type, and for ppt_outline itself until
  // a script has been created.
  scriptBySlideNumber: Map<number, string> | null;
}) {
  const slides = parsePptOutline(markdown);
  const total = slides.length;

  const [mediaBySlideNumber, setMediaBySlideNumber] = useState<Map<number, SlideMediaItem>>(new Map());
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);
  const [removingFor, setRemovingFor] = useState<number | null>(null);
  const [chartFormFor, setChartFormFor] = useState<number | null>(null);
  const [savingChartFor, setSavingChartFor] = useState<number | null>(null);
  const [chartDrafts, setChartDrafts] = useState<Record<number, ChartDraft>>({});

  useEffect(() => {
    if (!mediaEnabled || !generationId) return;
    let cancelled = false;
    fetch(`/api/generations/${generationId}/slide-media`)
      .then((res) => res.json())
      .then((data: { media?: SlideMediaItem[] }) => {
        if (cancelled || !data.media) return;
        setMediaBySlideNumber(new Map(data.media.map((m) => [m.slideNumber, m])));
      })
      .catch(() => {
        // A failed fetch just means no media shows up yet — every slide still works fine as a
        // plain text slide, so this fails silently rather than blocking the whole preview.
      });
    return () => {
      cancelled = true;
    };
  }, [mediaEnabled, generationId]);

  if (slides.length === 0) {
    return (
      <div className="card-elevated rounded-2xl border-dashed p-10 text-center text-muted-foreground">
        Couldn&apos;t find any slides to preview in this content — try <strong>Regenerate</strong>,
        or switch to <strong>Text</strong> to see the raw output.
      </div>
    );
  }

  async function generateImage(slideNumber: number) {
    if (!generationId) return;
    setGeneratingFor(slideNumber);
    try {
      const res = await fetch(`/api/generations/${generationId}/slide-media/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideNumber }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not generate that image.");
      setMediaBySlideNumber((prev) => {
        const next = new Map(prev);
        next.set(slideNumber, { slideNumber, kind: "image", url: data.url, chartType: null, chartData: null, prompt: null });
        return next;
      });
      toast.success(`Image added to Slide ${slideNumber}!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate that image.");
    } finally {
      setGeneratingFor(null);
    }
  }

  async function removeMedia(slideNumber: number) {
    if (!generationId) return;
    setRemovingFor(slideNumber);
    try {
      const res = await fetch(`/api/generations/${generationId}/slide-media?slideNumber=${slideNumber}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove that.");
      setMediaBySlideNumber((prev) => {
        const next = new Map(prev);
        next.delete(slideNumber);
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove that.");
    } finally {
      setRemovingFor(null);
    }
  }

  function updateDraft(slideNumber: number, patch: Partial<ChartDraft>) {
    setChartDrafts((prev) => {
      const current: ChartDraft = prev[slideNumber] ?? { chartType: "bar", title: "", text: "" };
      return { ...prev, [slideNumber]: { ...current, ...patch } };
    });
  }

  async function saveChart(slideNumber: number) {
    if (!generationId) return;
    const draft = chartDrafts[slideNumber];
    const parsedData = parseChartDraftText(draft?.text ?? "");
    if (!parsedData) {
      toast.error("Add at least 2 lines in the form \"Label, Value\".");
      return;
    }
    setSavingChartFor(slideNumber);
    try {
      const res = await fetch(`/api/generations/${generationId}/slide-media/chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideNumber,
          chartType: draft.chartType,
          title: draft.title.trim() || undefined,
          labels: parsedData.labels,
          values: parsedData.values,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not save that chart.");
      setMediaBySlideNumber((prev) => {
        const next = new Map(prev);
        next.set(slideNumber, {
          slideNumber,
          kind: "chart",
          url: null,
          chartType: data.chartType,
          chartData: { labels: data.labels, values: data.values },
          prompt: data.title,
        });
        return next;
      });
      setChartFormFor(null);
      toast.success(`Chart added to Slide ${slideNumber}!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that chart.");
    } finally {
      setSavingChartFor(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {slides.length} slide{slides.length === 1 ? "" : "s"} — scroll to see the whole deck. This is
        a layout preview; use <strong>Export .pptx (designed deck)</strong> above for the real,
        editable PowerPoint file, or <strong>Copy for Gamma</strong> to design it there instead.
      </p>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {slides.map((slide, index) => {
          const layout = classifySlideLayout(index, total, slide.title);
          const media = mediaBySlideNumber.get(slide.number);
          const showMediaControls = mediaEnabled && layout === "content" && generationId;
          const draft = chartDrafts[slide.number];
          const notes = scriptBySlideNumber?.get(slide.number) || slide.notes;
          const notesAreFullScript = Boolean(scriptBySlideNumber?.get(slide.number));

          return (
            <div
              key={slide.number}
              className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"
            >
              <div className="flex flex-col gap-3 bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  Slide {slide.number}
                </span>
                <h3 className="font-display text-base font-bold leading-snug">{slide.title}</h3>
                {slide.bullets.length > 0 && (
                  <ul className="space-y-1.5 text-xs leading-snug text-white/90">
                    {slide.bullets.map((bullet, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-white/40">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {media?.kind === "image" && media.url && (
                  <div className="relative -mx-1 mt-1 overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a signed Supabase Storage URL, not something next/image's optimizer can proxy */}
                    <img src={media.url} alt="" className="max-h-40 w-full object-cover" />
                  </div>
                )}
                {media?.kind === "chart" && media.chartData && (
                  <div className="mt-1 rounded-lg bg-white/10 p-2.5">
                    <MiniChart labels={media.chartData.labels} values={media.chartData.values} />
                  </div>
                )}
              </div>

              {showMediaControls && (
                <div className="border-t border-border/60 bg-card/40 p-3">
                  {media ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {media.kind === "image" ? "AI image added" : "Chart added"}
                      </span>
                      <div className="flex gap-1.5">
                        {media.kind === "image" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={generatingFor === slide.number}
                            onClick={() => generateImage(slide.number)}
                            title={`Regenerate (${SLIDE_IMAGE_CREDIT_COST} credits)`}
                          >
                            {generatingFor === slide.number ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          disabled={removingFor === slide.number}
                          onClick={() => removeMedia(slide.number)}
                        >
                          {removingFor === slide.number ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  ) : chartFormFor === slide.number ? (
                    <div className="space-y-2">
                      <div className="flex gap-1.5">
                        {SLIDE_CHART_TYPES.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => updateDraft(slide.number, { chartType: t })}
                            className={`rounded-md border px-2 py-1 text-[11px] capitalize ${
                              (draft?.chartType ?? "bar") === t
                                ? "border-primary bg-primary/15 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        value={draft?.text ?? ""}
                        onChange={(e) => updateDraft(slide.number, { text: e.target.value })}
                        placeholder={"One per line: Label, Value\ne.g.\nBefore, 20\nAfter, 85"}
                        rows={3}
                        className="text-xs"
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setChartFormFor(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={savingChartFor === slide.number}
                          onClick={() => saveChart(slide.number)}
                        >
                          {savingChartFor === slide.number && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                          Save chart
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={generatingFor === slide.number}
                        onClick={() => generateImage(slide.number)}
                        title={`${SLIDE_IMAGE_CREDIT_COST} credits`}
                      >
                        {generatingFor === slide.number ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ImagePlus className="mr-1 h-3.5 w-3.5" />
                        )}
                        {generatingFor === slide.number ? "Generating..." : `Generate image (${SLIDE_IMAGE_CREDIT_COST} cr)`}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setChartFormFor(slide.number)}
                      >
                        <BarChart3 className="mr-1 h-3.5 w-3.5" />
                        Add chart
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {notes && (
                <details className="border-t border-border/60 bg-card/40 px-3 py-2" open={notesAreFullScript}>
                  <summary className="cursor-pointer select-none text-[11px] font-medium text-muted-foreground hover:text-foreground">
                    Speaker notes{notesAreFullScript ? " (full script)" : ""}
                  </summary>
                  <p className="mt-1.5 whitespace-pre-line text-xs text-muted-foreground">{notes}</p>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
