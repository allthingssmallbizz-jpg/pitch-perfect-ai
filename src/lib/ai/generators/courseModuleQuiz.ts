import type { Project } from "@/types/database";
import { formatDiscoveryBlock } from "./shared";

export const COURSE_MODULE_QUIZ_CREDIT_COST = 3;
export const COURSE_MODULE_QUIZ_MAX_OUTPUT_TOKENS = 4000;

// A real course needs a way to prove the transformation actually landed for THIS module before a
// student moves to the next one — the whole reason "real transformation, not AI junk" mattered
// enough to build sub-modules and a real teaching deck in the first place. Same relationship to
// Course Outline as Build Module Slides: one module at a time, takes the FULL outline content
// directly (not the shared, 4000-character-truncated priorGenerations context — see
// courseModuleSlides.ts's own comment on why) so a later module's quiz doesn't silently lose its
// source material. Deliberately its own generator rather than folded into Build Module Slides —
// a member may want the quiz without slides yet, or slides without a quiz, and they're graded/used
// completely differently (a quiz has a right answer; a deck doesn't).
export function buildCourseModuleQuizPrompt(
  project: Project,
  courseOutlineContent: string,
  moduleIdentifier: string
): string {
  return `Build a knowledge-check quiz for ONE SPECIFIC MODULE of an already-built course curriculum — a real test of whether the transformation this module promises actually landed, not a trivia recap of terminology.

${formatDiscoveryBlock(project)}

FULL COURSE OUTLINE THIS MODULE BELONGS TO (for context and to find the right module):
${courseOutlineContent}

THE MODULE TO BUILD A QUIZ FOR: "${moduleIdentifier}"

Find that exact module in the course outline above (match by its number or name). Write a quiz covering ONLY that module's sub-modules and lessons — do not write questions about any other module.

Write roughly 1-2 questions per lesson in the module (so a module with more lessons gets a longer quiz, typically 8-15 questions total) using a mix of:
- **Multiple choice** (4 options, one correct) — favor application/judgment-call questions over pure definition recall wherever the lesson's content supports it (e.g. "Which of these is the right move when X happens?" beats "What does X stand for?").
- **True/False** — best for a common misconception this module specifically corrects (pull from the outline's false-belief/objection content where relevant).
- **1-2 short-answer/reflection questions** tied directly to the module's actual action step(s) — something only answerable if the student actually DID the action step, not just watched the lesson.

For each question, output:
- **Q#: [question text]**
- Options (for multiple choice/true-false) or a one-line "expected answer shape" note (for short-answer)
- **Correct answer**
- **Why**: one sentence explaining why that's correct — grounded in this module's actual content, not a generic explanation.

End with an **Answer key summary** (just question number → correct answer, for fast grading) and a **Passing guidance** line: what score/pattern of misses would suggest a student should revisit this module before moving on, versus is ready to continue.

Ground every question in this module's actual planned content (its sub-modules, lessons, and action steps) — never invent a fact, framework, or claim that wasn't already part of the outline or this project's discovery data.`;
}
