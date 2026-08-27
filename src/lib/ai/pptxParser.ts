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
const CONTENT_LABEL = /^[-*]?\s*\*{0,2}\s*on-slide content\*{0,2}\s*[:.]?\s*(.*)$/i;
const NOTES_LABEL = /^[-*]?\s*\*{0,2}\s*speaker notes\*{0,2}\s*[:.]?\s*(.*)$/i;
const BULLET_LINE = /^\s*[-*•]\s+(.*)$/;
const SEPARATOR_LINE = /^-{3,}$/;

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
      current.bullets.push(bullet[1].trim());
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed || SEPARATOR_LINE.test(trimmed)) continue;
    if (mode === "notes") {
      current.notes = current.notes ? `${current.notes} ${trimmed}` : trimmed;
    } else {
      // A stray line before any explicit "On-slide content"/"Speaker notes" label — most likely
      // more on-slide copy, so keep it as a bullet rather than dropping it.
      current.bullets.push(trimmed);
    }
  }
  pushCurrent();

  return slides;
}
