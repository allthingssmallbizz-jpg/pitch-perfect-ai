// Extracts the text layer out of a .pptx file so it can be pasted straight into the Presentation
// Analyzer's text path — for members whose PowerPoint copy/paste isn't giving them clean text
// (common with pasted images-of-text, SmartArt, or just editors that don't allow multi-slide
// select). A .pptx is itself a zip of per-slide XML (OOXML format); no OCR or layout parsing,
// just the text runs PowerPoint already stores per slide.
import JSZip from "jszip";

export class PptxParseError extends Error {}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

// Text runs (<a:t>) are grouped into paragraphs (<a:p>) — join runs within a paragraph (they're
// just formatting splits of one line), then join paragraphs with newlines so bullet structure
// survives.
function extractSlideText(xml: string): string {
  const paragraphs = xml.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? [];
  const lines = paragraphs
    .map((p) => {
      const runs = p.match(/<a:t>[^<]*<\/a:t>/g) ?? [];
      return runs.map((r) => decodeXmlEntities(r.slice(5, -6))).join("");
    })
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.join("\n");
}

function slideNumber(path: string): number {
  return Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

export async function extractPptxText(buffer: Buffer): Promise<{ text: string; slideCount: number }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new PptxParseError("That doesn't look like a valid PowerPoint (.pptx) file.");
  }

  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  if (slidePaths.length === 0) {
    throw new PptxParseError(
      "No slides found in that file — make sure it's a .pptx (older .ppt files need to be re-saved as .pptx first: File → Save As → PowerPoint Presentation)."
    );
  }

  const slideTexts = await Promise.all(
    slidePaths.map(async (path) => extractSlideText(await zip.files[path].async("string")))
  );

  const text = slideTexts
    .map((slideText, i) => `Slide ${i + 1}:\n${slideText || "(no text on this slide)"}`)
    .join("\n\n");

  return { text, slideCount: slidePaths.length };
}
