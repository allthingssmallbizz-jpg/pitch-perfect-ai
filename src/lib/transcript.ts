// Turns an uploaded webinar transcript into plain spoken text for Score My Webinar: caption files
// exported by Zoom, YouTube, Vimeo, Loom, etc. (.vtt / .srt), plain text, and Word documents.
// Server-only (Word files are read with JSZip from a Buffer). No AI involved — free to run.

import JSZip from "jszip";

export class TranscriptParseError extends Error {}

export const TRANSCRIPT_EXTENSIONS = ["txt", "vtt", "srt", "docx"] as const;
export type TranscriptExtension = (typeof TRANSCRIPT_EXTENSIONS)[number];

const TIMESTAMP_LINE = /^\s*(\d{1,2}:)?\d{1,2}:\d{2}([.,]\d{1,3})?\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}([.,]\d{1,3})?.*$/;
// A bare time on its own line ("0:05", "12:34", "1:02:03") — how YouTube's copied transcript looks.
const BARE_TIME_LINE = /^\s*\(?(\d{1,2}:)?\d{1,2}:\d{2}\)?\s*$/;
const CUE_NUMBER_LINE = /^\s*\d+\s*$/;

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// Caption files repeat themselves: rolling auto-captions show the same words across several cues.
// Keeps each line once (consecutive repeats dropped), strips cue numbers, timestamps, the WEBVTT
// header and NOTE/STYLE blocks, and inline tags — while keeping speaker names ("<v Aaron>" becomes
// "Aaron: ").
export function cleanCaptionText(raw: string, isCaptionFile = true): string {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let skippingBlock = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      skippingBlock = false;
      continue;
    }
    if (skippingBlock) continue;
    if (/^WEBVTT\b/.test(line) || /^(Kind|Language):/i.test(line)) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(line)) {
      skippingBlock = true;
      continue;
    }
    if (TIMESTAMP_LINE.test(line) || BARE_TIME_LINE.test(line) || CUE_NUMBER_LINE.test(line)) continue;
    // Inline caption markup (<v Speaker>, <c>, <i>, {\an8}) only exists in caption files — in a
    // Word or text transcript, "<" is just text the presenter wrote.
    const text = (
      isCaptionFile
        ? decodeEntities(
            line
              .replace(/<v(?:\.[^ >]+)?\s+([^>]+)>/g, "$1: ")
              .replace(/<\/?[^>]+>/g, "")
              .replace(/\{\\[^}]*\}/g, "")
          )
        : line
    )
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    if (out[out.length - 1] === text) continue;
    // Rolling captions: the next cue often starts with the whole previous line — keep just the new part.
    const prev = out[out.length - 1];
    if (prev && text.startsWith(prev) && text.length > prev.length) {
      out[out.length - 1] = text;
      continue;
    }
    out.push(text);
  }
  return out.join("\n");
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new TranscriptParseError("That Word file couldn't be opened — make sure it's a .docx file, not .doc.");
  }
  const doc = zip.file("word/document.xml");
  if (!doc) throw new TranscriptParseError("That doesn't look like a Word (.docx) document.");
  const xml = await doc.async("string");
  const paragraphs = xml.split(/<\/w:p>/).map((p) => {
    const withBreaks = p.replace(/<w:tab\/>/g, " ").replace(/<w:br\/>/g, "\n");
    const runs = [...withBreaks.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|\n/g)].map((m) => (m[0] === "\n" ? "\n" : m[1]));
    return decodeEntities(runs.join(""));
  });
  return paragraphs.map((p) => p.trim()).filter(Boolean).join("\n");
}

export async function extractTranscriptText(fileName: string, buffer: Buffer): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop() as TranscriptExtension;
  if (!TRANSCRIPT_EXTENSIONS.includes(ext)) {
    throw new TranscriptParseError("Upload a transcript as .txt, .vtt, .srt, or .docx.");
  }
  const text = ext === "docx" ? await extractDocxText(buffer) : buffer.toString("utf-8");
  // Plain text and Word transcripts often carry timestamps too (Zoom's .txt, a pasted YouTube
  // transcript), so everything goes through the same cleanup.
  const cleaned = cleanCaptionText(text, ext === "vtt" || ext === "srt");
  if (!cleaned.trim()) throw new TranscriptParseError("We couldn't find any spoken words in that file.");
  return cleaned;
}
