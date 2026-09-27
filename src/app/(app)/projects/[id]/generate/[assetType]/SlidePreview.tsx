"use client";

import { parsePptOutline } from "@/lib/ai/pptxParser";

// A visual "can I actually see the deck" view for Your Signature Webinar (ppt_outline) and Cora's
// Build Module Slides (course_module_slides) — both generators already write in the exact
// "Slide #: Title / On-slide content / Speaker notes" markdown that parsePptOutline (and the real
// .pptx export) already parse, so this reuses that same parser rather than inventing a second
// format to keep in sync. This is a layout preview, not the designed file itself — no fixed
// slide aspect ratio or bullet truncation, since a slide with more content than usual should still
// show all of it here rather than silently cropping it.
export default function SlidePreview({ markdown }: { markdown: string }) {
  const slides = parsePptOutline(markdown);

  if (slides.length === 0) {
    return (
      <div className="card-elevated rounded-2xl border-dashed p-10 text-center text-muted-foreground">
        Couldn&apos;t find any slides to preview in this content — try <strong>Regenerate</strong>,
        or switch to <strong>Text</strong> to see the raw output.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {slides.length} slide{slides.length === 1 ? "" : "s"} — scroll to see the whole deck. This is
        a layout preview; use <strong>Export .pptx (designed deck)</strong> above for the real,
        editable PowerPoint file, or <strong>Copy for Gamma</strong> to design it there instead.
      </p>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {slides.map((slide) => (
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
            </div>
            {slide.notes && (
              <details className="border-t border-border/60 bg-card/40 px-3 py-2">
                <summary className="cursor-pointer select-none text-[11px] font-medium text-muted-foreground hover:text-foreground">
                  Speaker notes
                </summary>
                <p className="mt-1.5 text-xs text-muted-foreground">{slide.notes}</p>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
