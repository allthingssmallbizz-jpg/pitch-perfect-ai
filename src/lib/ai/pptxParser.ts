// Turns the PPT Outline generator's markdown output (see src/lib/ai/generators/pptOutline.ts —
// "**Slide #: Title**" / "**On-slide content**" bullets / "**Speaker notes**") back into
// structured slide data a real .pptx builder can consume. Deliberately tolerant of formatting
// drift (missing bold markers, "-" vs "*" bullets, a colon vs. none) since this is parsing model
// output, not a fixed machine format — a slide that doesn't parse perfectly still produces a
// slide with *something* on it rather than silently vanishing from the deck.

export interface ParsedSlide {
  number: number;
  title: string;
  bullets: string[];
  notes: string;
}

const SLIDE_HEADING = /^#{0,4}\s*\*{0,2}\s*slide\s+(\d+)\s*[:.\-–]?\s*(.*?)\*{0,2}\s*$/i;

// A phase/day/module opener gets its own bold, full-color divider slide in the exported .pptx
// (see pptxDeckBuilder.ts) instead of blending into the regular content flow. Lives here (a pure,
// dependency-free file safe to import from either a server route or a "use client" component)
// rather than in pptxDeckBuilder.ts itself, which pulls in pptxgenjs — a Node-oriented library
// that has no business in a browser bundle. SlidePreview.tsx's per-slide "Generate image"/"Add
// chart" buttons need this same classification client-side, kept in sync with the real export by
// sharing this one function rather than a second copy of the regex.
const SECTION_HEADING = /^(phase\s+\d+|day\s+\d+|part\s+\d+|module\s+\d+)\b/i;
const CONTENT_LABEL = /^[-*]?\s*\*{0,2}\s*on-slide content\*{0,2}\s*[:.]?\s*(.*)$/i;
// Also matches a bare "Notes:" label, not just "Speaker notes" — a real deck that had gone
// through several "Add, remove, or change something" edit passes (each one echoing the entire
// 60-90 slide document back) came back using the shorter "Notes:" label instead, which this
// didn't recognize at all. Reported as Read Aloud's practice mode reading only headlines: with
// no label match, a short, single-sentence note (the prompt explicitly asks for 1-3 CONCISE
// sentences) also fails looksLikeSpokenProse's "2+ sentence enders or 220+ chars" fallback test,
// so it silently became an on-slide BULLET instead of a note — excluded from practice mode
// entirely, and, worse, leaking presenter-only text onto the visible slide in the real .pptx
// export too. Matching "Notes" alone fixes both without needing the member to regenerate or
// re-edit anything, since this re-parses the deck's existing stored markdown fresh every time.
const NOTES_LABEL = /^[-*]?\s*\*{0,2}\s*(?:speaker'?s?\s+)?notes\*{0,2}\s*[:.]?\s*(.*)$/i;
const BULLET_LINE = /^\s*[-*•]\s+(.*)$/;
const SEPARATOR_LINE = /^-{3,}$/;

// Reported: Read Aloud "jumping around" throughout a whole deck, heard as an abrupt, unrelated
// phrase landing right before a slide's own title — traced to a real deck's markdown containing
// standalone section-divider lines sitting BETWEEN slides, outside any "Slide #:"/"On-slide
// content"/"Speaker notes" structure entirely — e.g. "PHASE 1 — OPENING (Slides 1-7)" before the
// deck's first slide, and "Secret #1 — The Vehicle: ..." between two slides mid-deck. Nothing
// recognized these as anything special, so the catch-all prose-absorption path below silently
// tacked them onto whatever slide's notes came right before, meaning the presenter's own
// rehearsal audio would say something like "...falls apart on its own. Secret #1 — The Vehicle:
// Webinars Are Dead. The Night I Watched a Room Run to the Back..." right before the next slide's
// real title — no slide actually skipped, just an internal planning label injected as a jarring
// non-sequitur, over and over through the deck, which is exactly what reads as "jumping around."
// Requires the dash directly after the number (not just the word+number) specifically so a real
// sentence that happens to start the same way ("Day 30 is when everything changes for you")
// still reads as ordinary content instead of getting silently dropped.
const STRUCTURAL_DIVIDER_LINE = /^(?:phase|secret|day|part|module)\s*#?\s*\d+\s*[-–—]\s*.+$/i;

// A real generation came back with every "Speaker notes" paragraph rendered ON the visible
// slide instead of in PowerPoint's actual Notes pane — traced to Claude occasionally skipping
// the "**Speaker notes**" label entirely (common enough across 60-90 repeated slides) and just
// writing the note as trailing prose, which the parser then had no way to distinguish from a
// genuine on-slide bullet. Presenter notes are natural spoken prose (1-3 full sentences per the
// prompt); on-slide bullets are meant to be substantive single points now — real, specific claims
// a viewer could read on their own, not bare fragments — so they can legitimately run to a
// sentence-length phrase too. The reliable signal is sentence COUNT, not raw length: a leaked
// note is 2+ sentences strung together, while even a rich, detailed bullet is one. Length alone
// only kicks in for an extreme outlier (a bullet that's basically a whole paragraph with no
// period at all) rather than penalizing an intentionally fuller bullet for simply running long.
function looksLikeSpokenProse(line: string): boolean {
  const sentenceEnders = (line.match(/[.!?](\s|$)/g) ?? []).length;
  return sentenceEnders >= 2 || line.length > 220;
}

export type SlideLayoutKind = "title" | "section" | "closing" | "content";

// Single source of truth for which of the four .pptx layouts a given slide gets (see
// pptxDeckBuilder.ts's buildDeck) — and, since only "content" slides have a bullets column to
// attach a member-added image/chart to, also what the slide-media routes and SlidePreview.tsx use
// to decide which slides can even offer that option.
export function classifySlideLayout(index: number, total: number, title: string): SlideLayoutKind {
  if (index === 0) return "title";
  if (index === total - 1) return "closing";
  if (SECTION_HEADING.test(title.trim())) return "section";
  return "content";
}

export function parsePptOutline(markdown: string): ParsedSlide[] {
  const slides: ParsedSlide[] = [];
  let current: ParsedSlide | null = null;
  let mode: "content" | "notes" | null = null;

  function pushCurrent() {
    if (current && (current.title || current.bullets.length || current.notes)) slides.push(current);
  }

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd();
    const heading = line.match(SLIDE_HEADING);
    if (heading) {
      pushCurrent();
      const number = Number(heading[1]);
      current = {
        number: Number.isFinite(number) ? number : slides.length + 1,
        title: heading[2].replace(/\*+$/, "").trim() || `Slide ${heading[1]}`,
        bullets: [],
        notes: "",
      };
      mode = null;
      continue;
    }
    if (!current) continue;
    if (STRUCTURAL_DIVIDER_LINE.test(line.trim())) continue;

    const content = line.match(CONTENT_LABEL);
    if (content) {
      mode = "content";
      if (content[1].trim()) current.bullets.push(content[1].trim());
      continue;
    }
    const notes = line.match(NOTES_LABEL);
    if (notes) {
      mode = "notes";
      if (notes[1].trim()) current.notes = notes[1].trim();
      continue;
    }
    const bullet = line.match(BULLET_LINE);
    if (bullet && mode !== "notes") {
      const bulletText = bullet[1].trim();
      // A dash doesn't guarantee it's really a bullet — a mislabeled speaker note can still pick
      // up a leading "- " by accident. Route it by shape just like the unlabeled case below.
      if (looksLikeSpokenProse(bulletText)) {
        current.notes = current.notes ? `${current.notes} ${bulletText}` : bulletText;
      } else {
        current.bullets.push(bulletText);
      }
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed || SEPARATOR_LINE.test(trimmed)) continue;
    if (mode === "notes" || looksLikeSpokenProse(trimmed)) {
      // Either already inside an explicit notes block, or an unlabeled line that reads like
      // spoken prose rather than a slide bullet — see looksLikeSpokenProse's comment.
      current.notes = current.notes ? `${current.notes} ${trimmed}` : trimmed;
    } else {
      current.bullets.push(trimmed);
    }
  }
  pushCurrent();

  return slides;
}

// Turns a Webinar Script generation (see generators/webinarScript.ts — "**Slide #: Title**"
// followed by a flowing spoken-script paragraph, with no separate "On-slide content"/"Speaker
// notes" split to worry about) into the real presenter notes for the exported .pptx, keyed by
// slide number so the export can match each script section back to its slide in the deck. Reuses
// parsePptOutline purely for its slide-heading detection — every line under a script's heading
// ends up in `.bullets` (nothing in that format ever matches CONTENT_LABEL/NOTES_LABEL), so
// rejoining them reconstructs the full script paragraph for that slide.
export function parseWebinarScriptBySlideNumber(markdown: string): Map<number, string> {
  const slides = parsePptOutline(markdown);
  const map = new Map<number, string>();
  for (const slide of slides) {
    const text = [...slide.bullets, slide.notes].filter(Boolean).join(" ").trim();
    if (text) map.set(slide.number, text);
  }
  return map;
}
