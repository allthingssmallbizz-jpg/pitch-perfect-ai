import type { Project } from "@/types/database";
import { formatDiscoveryBlock } from "./shared";
import { parsePptOutline } from "../pptxParser";

export const COURSE_MODULE_SLIDES_CREDIT_COST = 5;
export const COURSE_MODULE_SLIDES_MAX_OUTPUT_TOKENS = 8000;

// A real module deck runs 8-20 slides per the prompt's own target range — this floor sits well
// below the bottom of that range on purpose (not right up against it), the same reasoning as
// PPT_OUTLINE_MIN_ACCEPTABLE_SLIDES: it's meant to catch a genuine failure (Claude compressing
// several lessons into one or two slides and stopping well short, the same real bug that
// motivated that constant — see its own comment) without false-triggering on a legitimately
// short, simple module that lands at 6-7 slides. Reuses parsePptOutline directly rather than a
// separate parser, since this generator's own prompt deliberately outputs the identical "Slide
// #: Title" / "On-slide content" / "Speaker notes" format (see buildCourseModuleSlidesPrompt).
export const COURSE_MODULE_SLIDES_MIN_ACCEPTABLE_SLIDES = 5;

export function isCourseModuleSlidesIncomplete(content: string): boolean {
  return parsePptOutline(content).length < COURSE_MODULE_SLIDES_MIN_ACCEPTABLE_SLIDES;
}

export const COURSE_MODULE_SLIDES_CONTINUATION_HINT =
  "You stopped short of a genuinely thorough deck for this one module — it is not done yet. Keep writing through the rest of this module's sub-modules and lessons (teaching content, then each lesson's action-step slide, then the final wrap-up slide) with the same one-slide-per-real-teaching-point pacing as before, not one slide per sub-module.";

// Course Outline's own "Sarah -> Polly" step: the outline is the strategic curriculum skeleton
// (module -> sub-module -> lesson beats), not the finished, presentable material — this is what
// actually turns ONE module of it into a real slide-by-slide teaching deck a course creator can
// open and record from, the same relationship Your Signature Webinar has to the Webinar
// Blueprint. Deliberately one deck per module rather than one giant deck for the whole course —
// a member records/teaches a module at a time, and a single all-modules deck would either be
// enormous or force compressing real teaching content to fit, exactly the "AI junk, not real
// transformation" outcome this exists to avoid.
//
// Takes the FULL course outline content directly (not through the shared formatPriorGenerationsBlock
// helper, which truncates prior-generation context to 4000 characters for other generators' "stay
// consistent with the Big Idea" purposes) — a real multi-module curriculum is routinely much
// longer than that, and truncating it would silently cut off any module past the first one or two,
// making this fail exactly when asked for a later module. See the dedicated fetch in
// src/app/api/generate/route.ts.
export function buildCourseModuleSlidesPrompt(
  project: Project,
  courseOutlineContent: string,
  moduleIdentifier: string
): string {
  return `Build a full slide-by-slide teaching deck (titles + on-slide content + speaker notes) for ONE SPECIFIC MODULE of an already-built course curriculum — the actual, presentable, recordable teaching material, not a summary of the outline.

${formatDiscoveryBlock(project)}

FULL COURSE OUTLINE THIS MODULE BELONGS TO (for context and to find the right module):
${courseOutlineContent}

THE MODULE TO BUILD SLIDES FOR: "${moduleIdentifier}"

Find that exact module in the course outline above (match by its number or name). Build slides for ONLY that module — do not build slides for any other module, and do not summarize the rest of the course. Follow the sub-module and lesson structure already planned for this module in the outline faithfully — expand it into real teaching slides, don't invent a different breakdown than what's already there.

Every lesson's expanded teaching — the examples, scenarios, numbers, language — must be specific to THIS project's actual niche, industry, and audience from Discovery above, never generic business-speak that could apply to any course. If a lesson in the outline reads vague, make it concrete and specific to this niche when you expand it, not abstract.

For each slide output:
- **Slide #: Title**
- **On-slide content**: 3-5 SHORT bullets — each a scannable cue phrase a viewer reads in 2-3 seconds (roughly 4-10 words), never a full sentence or explanation. A bullet names WHAT the point is; it does not try to teach or justify it on the slide. If what you're trying to say needs more than one breath to read, that's a sign it belongs in speaker notes instead, not jammed onto the slide. A real teaching deck a student can actually follow along with has LESS text on screen, not more — the depth lives in speaker notes below, never on the slide itself.
- **Speaker notes**: 3-5 sentences of what the presenter actually SAYS while teaching this slide — this is where the real explanation, the specific niche-grounded example, the "why" and the "how" all live. Real teaching language, not a recap of the bullets above it. Where a point is naturally better shown than listed (a before/after, a step sequence, a comparison, a visual process), say so explicitly in the notes — Build Module Slides' own "Generate image" / "Add chart" tools can turn that into a real visual once the deck exists.

Readability rule: a viewer should get a slide's point on a 3-second glance. If a slide needs real reading to parse — a wall of text, a bullet that's actually a paragraph, more than 5 bullets — that slide has failed, no matter how accurate the content is. This is a teaching deck meant to be watched and followed along with, not a document being displayed.

Structure the deck as:
1. **Module opener slide** — restate this module's outcome/promise: what will be true for the student by the end of this module specifically.
2. **One intro slide per sub-module**, immediately followed by **one or more slides per lesson within it** — enough SLIDES to actually teach each lesson's content thoroughly (break a dense lesson into more slides, each with its own short, focused point — never into one slide with more bullets).
3. **A closing slide for each lesson's action step** — presented as a clear, on-screen instruction for what the student does now, not buried inside a content slide.
4. **Final wrap-up slide** — restate this module's milestone (the concrete checkpoint that proves it landed) and exactly what the student needs to have done before moving to the next module.

This needs to be a real, thorough teaching deck for this one module — typically 8-20 slides depending on how many sub-modules and lessons this module actually has (err toward MORE, shorter slides when the module covers real ground, never toward fewer, denser ones). Every slide earns its place with a real, specific, niche-grounded point; a slide with a bare topic label, or a slide crammed with more text than a 3-second glance can take in, are both a failure to fix.`;
}
