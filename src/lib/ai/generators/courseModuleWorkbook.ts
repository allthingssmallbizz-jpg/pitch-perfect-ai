import type { Project } from "@/types/database";
import { formatDiscoveryBlock } from "./shared";

export const COURSE_MODULE_WORKBOOK_CREDIT_COST = 4;
export const COURSE_MODULE_WORKBOOK_MAX_OUTPUT_TOKENS = 6000;

// The student's own hands-on companion for ONE module — distinct from both Build Module Slides
// (the instructor's teaching material, meant to be presented/recorded) and Module Quiz (a
// knowledge check with right/wrong answers). This is what a student actually writes in WHILE
// working through the module: the action step turned into a real fillable exercise, not just a
// restated instruction, plus reflection prompts and a completion checklist tied to the module's
// actual milestone — the tool that makes "real transformation, not just watched content" concrete
// and checkable for the student themselves, not just the course creator. Same shape as its two
// siblings: one module at a time, full outline content passed directly (not the shared,
// 4000-character-truncated priorGenerations context — see courseModuleSlides.ts's own comment).
export function buildCourseModuleWorkbookPrompt(
  project: Project,
  courseOutlineContent: string,
  moduleIdentifier: string
): string {
  return `Build a student workbook — a hands-on companion document a student fills in WHILE working through ONE SPECIFIC MODULE of an already-built course curriculum. This is not teaching material and not a quiz; it's the tool that turns "watched the lesson" into "actually did the work."

${formatDiscoveryBlock(project)}

FULL COURSE OUTLINE THIS MODULE BELONGS TO (for context and to find the right module):
${courseOutlineContent}

THE MODULE TO BUILD A WORKBOOK FOR: "${moduleIdentifier}"

Find that exact module in the course outline above (match by its number or name). Build a workbook covering ONLY that module's sub-modules and lessons — do not cover any other module.

Produce the workbook in this structure:

1. **Module recap** — one or two sentences restating this module's outcome/promise, so a student opening the workbook alone (without the slides in front of them) still knows what this module is for.

2. **One section per sub-module.** For EACH sub-module, and for EACH lesson within it, include:
   - A one-line recap of the lesson's teaching point (just enough context — this is not a repeat of the full lesson).
   - **The exercise** — turn the lesson's actual action step into a real, fillable worksheet element: numbered fill-in-the-blank prompts, a planning template with labeled blanks, a short checklist, or a "write your own X here" block — whatever concretely fits that specific action step. Never just restate the action step as an instruction with no place to actually do it.
   - **A reflection prompt** — one specific question that surfaces resistance, a realization, or a decision the student needs to make to actually apply this (e.g. "What's the one part of this that feels hardest for you right now, and why?"), not a generic "what did you learn?"

3. **Notes** — a labeled blank space per lesson for the student's own notes (just the label; no content to fill in here).

4. **Module completion checklist** — a checklist of concrete, checkable items that together prove this module's actual milestone was hit (each item something the student can honestly check yes/no on, not "I understand the concepts").

5. **Before you move on** — a short self-assessment (e.g. rate your confidence 1-5 on the module's core skill, plus one open question: "What would make you MORE confident before starting the next module?") — a readiness check, not a graded test.

Ground every exercise and prompt in this module's actual planned sub-modules, lessons, and action steps from the outline — never invent content that wasn't already part of the plan. This needs to be genuinely usable as a printable/fillable document, not a compressed summary of the module.`;
}
