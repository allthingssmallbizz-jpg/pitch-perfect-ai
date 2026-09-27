import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";

export const COURSE_OUTLINE_CREDIT_COST = 6;
// Raised from 10000 once modules gained a sub-module layer (Module -> Sub-module -> Lessons,
// not just Module -> Lessons) — a genuine curriculum, not a flat list, needs the extra room.
export const COURSE_OUTLINE_MAX_OUTPUT_TOKENS = 12000;

export const COURSE_LEVELS = ["Basic", "Intermediate", "Advanced"] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export function isCourseLevel(value: string): value is CourseLevel {
  return (COURSE_LEVELS as readonly string[]).includes(value);
}

const LEVEL_GUIDANCE: Record<CourseLevel, string> = {
  Basic:
    "BASIC — assume zero prior knowledge or experience. Define every term the first time it's used, over-explain rather than under-explain, and keep each lesson's action step small enough that a true beginner can't get stuck. Favor more modules with a narrower scope each over fewer modules that skip steps.",
  Intermediate:
    "INTERMEDIATE — assume the basic vocabulary and concepts of this niche are already familiar; don't re-teach fundamentals. Move faster into real application, judgment calls, and putting pieces together, not just defining them.",
  Advanced:
    "ADVANCED — assume real working competence already exists. Skip fundamentals entirely and focus on nuance, edge cases, optimization, troubleshooting what goes wrong, and the judgment calls that separate someone competent from someone excellent at this.",
};

// A course is a different shape of transformation asset than a Webinar or Challenge: not one
// sitting/live event, but a structured, self-paced (or cohort-paced) journey from a stated
// starting point (A) to a stated result (B), broken into modules a person works through over
// time. Built from the same discovery brief every other generator uses — no separate set of
// business facts needed, since a course's content is still this project's actual expertise,
// audience, and transformation, just delivered in a different container.
export function buildCourseOutlinePrompt(
  project: Project,
  priorGenerations: PriorGeneration[] = [],
  courseLevel: CourseLevel = "Intermediate",
  // Free text a member can type before generating — a course title they've already settled on,
  // specific module names they want kept exactly as written, or both. Deliberately optional and
  // deliberately loose (not split into a separate "course name" field vs. "module names" field):
  // someone may only care about naming the course itself, only the modules, both, or neither and
  // let Cora invent everything — forcing a rigid shape here would mean guessing which case applies.
  customNaming?: string
): string {
  const naming = customNaming?.trim();
  return `Build a full module-by-module course outline for the project below — a structured, transformational course that takes someone from where they are now (A) to a specific, stated result (B), one module and lesson at a time.

${formatDiscoveryBlock(project)}
${formatPriorGenerationsBlock(priorGenerations)}

TARGET LEVEL: ${courseLevel}
${LEVEL_GUIDANCE[courseLevel]}

${
  naming
    ? `NAMING — THE MEMBER ALREADY SUPPLIED THIS, USE IT EXACTLY, DO NOT INVENT A REPLACEMENT:
"${naming}"
Read the above carefully: it may specify the course title, specific module names, specific sub-module names, or any combination — sometimes only some of them. Use whatever it specifies verbatim, word-for-word, in the matching spot below (the course title in step 1, a named module or sub-module in its matching slot in step 5, in the same order they were given). Only invent a name yourself for whatever this note did NOT cover — never override something the member explicitly named.`
    : `NAMING — the member left this blank, so invent the course title and every module name yourself, grounded in this project's actual discovery facts (not a generic template name).`
}

Produce the outline in this structure:

1. **Course name and transformation promise** — a specific, outcome-driven title (not "The [Niche] Course") and a one-sentence promise of the exact A → B transformation: where the student starts, and what they can specifically do, have, or be by the end if they complete every module.

2. **Who this is for** — restate the target student in one or two sentences (pulled from this project's actual audience/awareness level), including what makes them ready for THIS level specifically — a Basic course should say what makes someone a fit despite having zero experience; an Advanced course should say what baseline it assumes they already have.

3. **Course map** — decide the right number of modules for this transformation and level (typically 4-8; fewer, deeper modules for a narrow/Advanced transformation, more, smaller modules for a broad/Basic one) and list them as a one-line-each table of contents before the detailed breakdown, so the whole arc is visible at a glance.

4. **Module 0 — Welcome & Orientation**: what to expect across the course, how it's meant to be worked through (in order, at what pace), the one habit or mindset shift that makes the rest of the course actually land, and a small first action that creates immediate momentum before Module 1's real content starts.

5. **One block per course module — a real nested curriculum, not a flat list.** Every module breaks down into sub-modules, and every sub-module breaks down into lessons: Module → Sub-module(s) → Lesson(s). For EACH module, include:
   - **Module outcome** — the specific capability or result a student has by the end of this module, not just a topic it "covers."
   - **Sub-modules within the module** (2-4 per module) — each one a distinct, named chunk of the module's arc (e.g. Module 3 "Building Your Offer" might break into Sub-module 3.1 "Pricing Psychology" and Sub-module 3.2 "Packaging & Positioning"), each with its own one-line outcome.
     - **Lessons within each sub-module** (2-4 per sub-module) — for each lesson: a title, the core teaching beat (bullet beats, not a full script — this is a skeleton to build a written lesson, video, or live session from), and one specific, completable **action step** that makes the lesson real rather than passively consumed.
   - **Module milestone** — the concrete checkpoint that proves this module actually landed (a finished deliverable, a specific decision made, a specific skill demonstrated) — not "understands the concepts."

6. **Final module — Integration & Completion**: a capstone action that requires combining everything from earlier modules to prove the full A → B transformation actually happened, plus a natural bridge to what comes next (continuity, community, a done-with-you upsell, or simply "you're done and here's how to keep the result") — whichever fits this project's actual offer ladder/funnel type.

7. **Delivery mechanics** — a short section covering: recommended format (self-paced vs. live cohort with calls), suggested pacing (all-at-once vs. drip-released, and roughly how long the full course should take a student to complete), and the accountability mechanism that keeps completion rates high (a community, check-ins, a progress tracker) — calibrated to the level: Basic students typically need more built-in accountability than Advanced ones.

Keep each lesson to a one-screen block: a one-line objective followed by bullet beats — not full prose script or word-for-word lesson content. This is the strategic curriculum skeleton — module and sub-module structure, lesson beats, action steps — that Agent Cora's own "Build Module Slides" step turns into an actual slide-by-slide teaching deck for each module; it is not the finished teaching material itself.`;
}
