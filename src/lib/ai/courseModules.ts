import type { AssetType } from "@/types/database";

// Agent Cora's four asset types, in one place — used to gate the Completed Courses feature
// (approve/unapprove, the Completed section itself) to just these, the same way
// SLIDE_MEDIA_ASSET_TYPES gates the slide-image/chart feature to just course_module_slides.
export const COURSE_ASSET_TYPES: AssetType[] = [
  "course_outline",
  "course_module_slides",
  "course_module_quiz",
  "course_module_workbook",
];

// Pulls the real, member-facing list of modules out of an already-generated Course Outline
// (course_outline) — used to replace the free-text "which module?" input on Cora's Build Module
// Slides/Quiz/Workbook pages with a dropdown of the course's actual modules, and to figure out
// "the next one" for the one-click "Build the next module" button (see GenerateClient.tsx).
//
// The prompt (courseOutline.ts) asks for a strict `Module #: Title` line per module in the
// Course Map section specifically so this stays reliable — but this still tolerates the usual
// markdown drift (bullet/number prefixes, bold markers, a missing colon) the same way
// pptxParser.ts does for slides, since older outlines were generated before that instruction
// existed. The 100-char cap plus requiring the line to START with "module" (not "sub-module")
// is what keeps this from also matching a stray "...as covered in Module 2, ..." sentence
// buried in body prose.
export interface CourseModuleRef {
  number: number;
  title: string;
}

const MODULE_LINE = /^(?:[-*]\s*)?(?:\d+[.)]\s*)?\**\s*module\s+(\d+)\s*[:.\-–—]?\s*(.*?)\**\s*$/i;

export function parseCourseModuleList(outlineContent: string): CourseModuleRef[] {
  const seen = new Map<number, CourseModuleRef>();
  for (const rawLine of outlineContent.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.length > 100) continue;
    const match = line.match(MODULE_LINE);
    if (!match) continue;
    const number = Number(match[1]);
    if (!Number.isFinite(number) || seen.has(number)) continue; // first mention wins — the heading itself, not a later cross-reference
    const rest = match[2].trim();
    seen.set(number, { number, title: rest ? `Module ${number}: ${rest}` : `Module ${number}` });
  }
  return [...seen.values()].sort((a, b) => a.number - b.number);
}
