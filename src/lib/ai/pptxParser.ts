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

// A real generation came back with every "Speaker notes" paragraph rendered ON the visible
// slide instead of in PowerPoint's actual Notes pane — traced to Claude occasionally skipping
// the "**Speaker notes**" label entirely (common enough across 60-90 repeated slides) and just
// writing the note as trailing prose, which the parser then had no way to distinguish from a
// genuine on-slide bullet. Presenter notes are natural spoken prose (full sentences); on-slide
// bullets are short phrases ("headline + up to 3 bullets" per the prompt). This shape-based guess
// is the safety net for exactly that unlabeled case — it doesn't replace the real labels, it
// only decides where an unlabeled line goes when the label Claude was supposed to add is missing.
function looksLikeSpokenProse(line: string): boolean {
  const sentenceEnders = (line.match(/[.!?](\s|$)/g) ?? []).length;
  return line.length > 90 || sentenceEnders >= 2;
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
