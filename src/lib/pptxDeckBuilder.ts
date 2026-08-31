import PptxGenJS from "pptxgenjs";
import type { ParsedSlide } from "./ai/pptxParser";

// A real, designed slide theme system — title/section/content/closing layouts, brand colors,
// decorative shapes, and a consistent footer — instead of one flat layout repeated 60-90 times.
// This is the "professional template" tier: every slide is built from a handful of layout
// functions below, not a unique AI-generated image per slide (which would cost real generation
// credits per slide and take many minutes for a full deck).

export interface DeckTheme {
  primary: string;
  secondary: string;
  accent: string;
  outline: string;
}

// Matches the login page's own violet/gold identity (src/components/LoginBackdrop.tsx) so a
// member who hasn't set brand colors yet still gets a deck that looks like it belongs to this
// product, not a generic default.
export const DEFAULT_THEME: DeckTheme = {
  primary: "6D5EF0",
  secondary: "15121F",
  accent: "E8B84B",
  outline: "3A3550",
};

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

function stripHash(hex: string): string {
  return hex.trim().replace(/^#/, "").toUpperCase();
}

function pickColor(value: string | null | undefined, fallback: string): string {
  return value && HEX_RE.test(value.trim()) ? stripHash(value) : fallback;
}

export function resolveTheme(
  brand: { primary_color?: string | null; secondary_color?: string | null; accent_color?: string | null; outline_color?: string | null } | null
): DeckTheme {
  if (!brand) return DEFAULT_THEME;
  return {
    primary: pickColor(brand.primary_color, DEFAULT_THEME.primary),
    secondary: pickColor(brand.secondary_color, DEFAULT_THEME.secondary),
    accent: pickColor(brand.accent_color, DEFAULT_THEME.accent),
    outline: pickColor(brand.outline_color, DEFAULT_THEME.outline),
  };
}

// WCAG relative luminance, used to pick readable text color against an arbitrary brand hex
// rather than assuming every member's "secondary" color is dark (some will pick a light one).
function relativeLuminance(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function textOn(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.5 ? "1A1A2E" : "FFFFFF";
}

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;

// A phase/day/module opener gets its own bold, full-color divider slide instead of blending into
// the regular content flow — this is what actually breaks a 60-90 slide deck into a presentation
// that reads as structured, not a wall of identical slides.
const SECTION_HEADING = /^(phase\s+\d+|day\s+\d+|part\s+\d+|module\s+\d+)\b/i;

function footer(slide: PptxGenJS.Slide, index: number, total: number, brandName: string, textColor: string, accent: string) {
  slide.addShape("rect", { x: 0, y: SLIDE_H - 0.36, w: SLIDE_W, h: 0.015, fill: { color: accent, transparency: 55 } });
  slide.addText(brandName, {
    x: 0.5,
    y: SLIDE_H - 0.36,
    w: 8,
    h: 0.3,
    fontSize: 9,
    color: textColor,
    transparency: 45,
    align: "left",
    valign: "middle",
    fontFace: "Arial",
  });
  slide.addText(`${index + 1} / ${total}`, {
    x: SLIDE_W - 2,
    y: SLIDE_H - 0.36,
    w: 1.5,
    h: 0.3,
    fontSize: 9,
    color: textColor,
    transparency: 45,
    align: "right",
    valign: "middle",
    fontFace: "Arial",
  });
}

function addTitleSlide(
  pptx: PptxGenJS,
  parsed: ParsedSlide,
  theme: DeckTheme,
  brandName: string,
  total: number
): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  const text = textOn(theme.secondary);
  slide.background = { color: theme.secondary };

  slide.addShape("ellipse", {
    x: SLIDE_W - 5.5,
    y: -3,
    w: 9,
    h: 9,
    fill: { color: theme.primary, transparency: 78 },
    line: { type: "none" },
  });
  slide.addShape("ellipse", {
    x: -3,
    y: SLIDE_H - 4,
    w: 6,
    h: 6,
    fill: { color: theme.accent, transparency: 85 },
    line: { type: "none" },
  });
  slide.addShape("rect", { x: 0.9, y: 2.55, w: 0.09, h: 1.9, fill: { color: theme.accent } });

  slide.addText(brandName.toUpperCase(), {
    x: 1.2,
    y: 1.7,
    w: 10,
    h: 0.5,
    fontSize: 14,
    bold: true,
    color: theme.accent,
    charSpacing: 2,
    fontFace: "Arial",
  });
  slide.addText(parsed.title, {
    x: 1.2,
    y: 2.5,
    w: 10.8,
    h: 2.1,
    fontSize: 40,
    bold: true,
    color: text,
    fontFace: "Arial",
    valign: "top",
  });
  if (parsed.bullets.length > 0) {
    slide.addText(parsed.bullets.slice(0, 3).join("   •   "), {
      x: 1.2,
      y: 4.5,
      w: 10.5,
      h: 0.8,
      fontSize: 16,
      color: text,
      transparency: 25,
      fontFace: "Arial",
    });
  }
  footer(slide, 0, total, brandName, text, theme.accent);
  return slide;
}

function addSectionSlide(
  pptx: PptxGenJS,
  parsed: ParsedSlide,
  theme: DeckTheme,
  index: number,
  total: number,
  brandName: string
): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  const text = textOn(theme.primary);
  slide.background = { color: theme.primary };

  slide.addShape("rect", { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, fill: { color: theme.secondary, transparency: 88 } });
  slide.addText(`SECTION ${index + 1}`, {
    x: 1.2,
    y: 2.7,
    w: 10,
    h: 0.5,
    fontSize: 14,
    bold: true,
    color: text,
    transparency: 20,
    charSpacing: 3,
    fontFace: "Arial",
  });
  slide.addShape("rect", { x: 1.25, y: 3.3, w: 1.4, h: 0.07, fill: { color: theme.accent } });
  slide.addText(parsed.title, {
    x: 1.2,
    y: 3.5,
    w: 10.8,
    h: 1.6,
    fontSize: 34,
    bold: true,
    color: text,
    fontFace: "Arial",
    valign: "top",
  });
  footer(slide, index, total, brandName, text, theme.accent);
  return slide;
}

function addContentSlide(
  pptx: PptxGenJS,
  parsed: ParsedSlide,
  theme: DeckTheme,
  index: number,
  total: number,
  brandName: string
): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  const heading = "1A1A2E";
  const body = "3A3A4A";
  slide.background = { color: "FFFFFF" };

  // A brand-colored spine down the left edge, consistent across every content slide — the thing
  // that makes a 78-slide deck still read as one designed presentation rather than 78 unrelated
  // pages.
  slide.addShape("rect", { x: 0, y: 0, w: 0.22, h: SLIDE_H, fill: { color: theme.primary } });
  slide.addShape("rect", { x: 0.22, y: 0, w: 0.05, h: SLIDE_H, fill: { color: theme.accent } });

  slide.addText(parsed.title, {
    x: 0.75,
    y: 0.55,
    w: 11.9,
    h: 1.05,
    fontSize: 27,
    bold: true,
    color: heading,
    fontFace: "Arial",
    valign: "top",
  });
  slide.addShape("rect", { x: 0.78, y: 1.5, w: 1.5, h: 0.06, fill: { color: theme.accent } });

  if (parsed.bullets.length > 0) {
    // The prompt asks for "up to 3 bullets" per slide; pptxParser's looksLikeSpokenProse now
    // keeps genuine mislabeled speaker-note paragraphs out of `.bullets` entirely, but this cap
    // is a second, cheap layer of insurance against a content slide ever visually flooding with
    // text again — a real slide should never actually need more than a handful of bullets.
    slide.addText(
      parsed.bullets.slice(0, 6).map((b) => ({
        text: b,
        options: { bullet: { code: "25A0", indent: 18 }, color: theme.primary, breakLine: true },
      })),
      {
        x: 0.9,
        y: 1.95,
        w: 11.6,
        h: 4.6,
        fontSize: 18,
        color: body,
        valign: "top",
        fontFace: "Arial",
        lineSpacingMultiple: 1.35,
        // Bullet glyphs are colored via each run's own `color` above; this base color only
        // applies where a run doesn't override it, so bullet copy itself stays neutral/readable
        // regardless of how bright the brand's primary color is.
      }
    );
  }

  footer(slide, index, total, brandName, "8A8A99", theme.outline);
  return slide;
}

function addClosingSlide(
  pptx: PptxGenJS,
  parsed: ParsedSlide,
  theme: DeckTheme,
  total: number,
  brandName: string
): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  const text = textOn(theme.secondary);
  slide.background = { color: theme.secondary };

  slide.addShape("ellipse", {
    x: -4,
    y: -4,
    w: 8,
    h: 8,
    fill: { color: theme.primary, transparency: 80 },
    line: { type: "none" },
  });

  slide.addText(parsed.title, {
    x: 1,
    y: 1.7,
    w: 11.3,
    h: 1.8,
    fontSize: 34,
    bold: true,
    color: text,
    align: "center",
    fontFace: "Arial",
  });

  if (parsed.bullets.length > 0) {
    slide.addText(
      parsed.bullets.map((b) => ({ text: b, options: { bullet: { code: "2022" }, breakLine: true } })),
      {
        x: 2.5,
        y: 3.4,
        w: 8.3,
        h: 2,
        fontSize: 16,
        color: text,
        transparency: 15,
        align: "left",
        valign: "top",
        fontFace: "Arial",
        lineSpacingMultiple: 1.3,
      }
    );
  }

  // A non-interactive "button" shape — still reads as a clear CTA moment even though PowerPoint
  // playback obviously can't make it clickable.
  slide.addShape("roundRect", {
    x: SLIDE_W / 2 - 1.8,
    y: 6,
    w: 3.6,
    h: 0.7,
    rectRadius: 0.35,
    fill: { color: theme.accent },
    line: { type: "none" },
  });
  slide.addText(parsed.notes ? "Let's go" : "Take the next step", {
    x: SLIDE_W / 2 - 1.8,
    y: 6,
    w: 3.6,
    h: 0.7,
    fontSize: 15,
    bold: true,
    color: textOn(theme.accent),
    align: "center",
    valign: "middle",
    fontFace: "Arial",
  });

  footer(slide, total - 1, total, brandName, text, theme.accent);
  return slide;
}

export function buildDeck(
  slides: ParsedSlide[],
  theme: DeckTheme,
  brandName: string,
  scriptBySlideNumber?: Map<number, string>
): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "PP_WIDESCREEN", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "PP_WIDESCREEN";
  pptx.author = brandName;
  pptx.title = slides[0]?.title || "Presentation";

  const total = slides.length;
  slides.forEach((parsed, index) => {
    const slide =
      index === 0
        ? addTitleSlide(pptx, parsed, theme, brandName, total)
        : index === total - 1
          ? addClosingSlide(pptx, parsed, theme, total, brandName)
          : SECTION_HEADING.test(parsed.title.trim())
            ? addSectionSlide(pptx, parsed, theme, index, total, brandName)
            : addContentSlide(pptx, parsed, theme, index, total, brandName);

    // A completed Webinar Script's own per-slide talk-track is a far fuller, more usable set of
    // presenter notes than the outline's own embedded 1-3 sentence notes — see the export route's
    // scriptBySlideNumber query — so it wins whenever this slide number has an entry there. Either
    // way, this only ever calls .addNotes(), which writes to PowerPoint's actual Notes pane; it
    // never touches the visible slide body.
    const notes = scriptBySlideNumber?.get(parsed.number) || parsed.notes;
    if (notes) slide.addNotes(notes);
  });

  return pptx;
}
