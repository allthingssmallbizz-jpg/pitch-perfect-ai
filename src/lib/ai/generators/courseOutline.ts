import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";

export const COURSE_OUTLINE_CREDIT_COST = 6;
// Raised from 10000 once modules gained a sub-module layer (Module -> Sub-module -> Lessons,
// not just Module -> Lessons) — a genuine curriculum, not a flat list, needs the extra room.
// Raised again from 12000 once the mandatory Module 1 (Welcome) + Module 2 (Mindset) became a
// required addition to every course's real content modules, not a replacement for any of them.
export const COURSE_OUTLINE_MAX_OUTPUT_TOKENS = 14000;

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

3. **Course map** — decide the right number of CONTENT modules for this transformation and level (typically 4-8 beyond the two fixed modules below; fewer, deeper modules for a narrow/Advanced transformation, more, smaller modules for a broad/Basic one) and list the full sequence — Module 1 Welcome, Module 2 Mindset, then every content module, then the final Integration module — as a one-line-each table of contents before the detailed breakdown, so the whole arc is visible at a glance.

4. **Module 1 — Welcome & Orientation**: what to expect across the course, how it's meant to be worked through (in order, at what pace), and a small first action that creates immediate momentum before Module 2 starts.

5. **Module 2 — Mindset (REQUIRED ON EVERY COURSE, NO EXCEPTIONS)**: before any real content, every course this generates must build the specific mindset someone needs to actually execute and finish THIS transformation — not a generic "believe in yourself" module, but one written directly to this project's actual niche and audience (a real estate agent's mindset module talks about real estate rejection and slow-close months; a government-contractor course talks about bureaucratic delay and losing bids; whatever this project's discovery facts say the student is actually pursuing). Cover, grounded in that specific pursuit:
   - the specific roadblocks, setbacks, and slow patches someone in THIS pursuit predictably hits, named concretely, not abstractly
   - that there will be real ups and downs on the way to the result, and why that's normal here, not a sign of failure
   - the mental shift that separates someone who sticks with it through those patches from someone who quits before the payoff
   - a concrete way the student recommits or resets when they hit a rough patch (a reframe, a ritual, a next-action they take instead of quitting)
   Still follow the Sub-module → Lesson structure below (a lighter 1-2 sub-modules is fine here), and give it its own module milestone. This module and Module 1 are the most important modules in the entire course — they determine whether a student actually finishes the rest.

6. **One block per remaining content module (Module 3 onward) — a real nested curriculum, not a flat list.** Every module breaks down into sub-modules, and every sub-module breaks down into lessons: Module → Sub-module(s) → Lesson(s). For EACH module, include:
   - **Module outcome** — the specific capability or result a student has by the end of this module, not just a topic it "covers."
   - **Sub-modules within the module** (2-4 per module) — each one a distinct, named chunk of the module's arc (e.g. Module 4 "Building Your Offer" might break into Sub-module 4.1 "Pricing Psychology" and Sub-module 4.2 "Packaging & Positioning"), each with its own one-line outcome.
     - **Lessons within each sub-module** (2-4 per sub-module) — for each lesson: a title, the core teaching beat (bullet beats, not a full script — this is a skeleton to build a written lesson, video, or live session from), and one specific, completable **action step** that makes the lesson real rather than passively consumed.
   - **Module milestone** — the concrete checkpoint that proves this module actually landed (a finished deliverable, a specific decision made, a specific skill demonstrated) — not "understands the concepts."
   - **Module close** — a one-line prompt telling the student to complete that module's quiz (Agent Cora's separate "Build Module Quiz" step) before moving on, so each module's principles actually get applied and checked, not just read.

7. **Final module — Integration & Completion**: a capstone action that requires combining everything from earlier modules to prove the full A → B transformation actually happened, plus a natural bridge to what comes next (continuity, community, a done-with-you upsell, or simply "you're done and here's how to keep the result") — whichever fits this project's actual offer ladder/funnel type.

8. **Delivery mechanics** — a short section covering: recommended format (self-paced vs. live cohort with calls), suggested pacing (all-at-once vs. drip-released, and roughly how long the full course should take a student to complete), and the accountability mechanism that keeps completion rates high (a community, check-ins, a progress tracker) — calibrated to the level: Basic students typically need more built-in accountability than Advanced ones.

Keep each lesson to a one-screen block: a one-line objective followed by bullet beats — not full prose script or word-for-word lesson content. This is the strategic curriculum skeleton — module and sub-module structure, lesson beats, action steps — that Agent Cora's own "Build Module Slides" step turns into an actual slide-by-slide teaching deck for each module; it is not the finished teaching material itself.`;
}
