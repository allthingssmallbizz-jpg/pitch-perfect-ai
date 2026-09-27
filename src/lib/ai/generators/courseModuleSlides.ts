import type { Project } from "@/types/database";
import { formatDiscoveryBlock } from "./shared";

export const COURSE_MODULE_SLIDES_CREDIT_COST = 5;
export const COURSE_MODULE_SLIDES_MAX_OUTPUT_TOKENS = 8000;

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

For each slide output:
- **Slide #: Title**
- **On-slide content**: 2-4 bullets, EVERY one a complete, specific, substantive point — a real explanation, framework step, example, or instruction a viewer could read and understand on its own, not a bare topic label. This is real transformation content, not a placeholder — if a bullet doesn't teach something specific, it's a failure to fix.
- **Speaker notes**: 2-4 sentences of what the presenter actually SAYS while teaching this slide — real teaching language walking through the point, giving the "why" and the "how," not just a recap of the bullets above it.

Structure the deck as:
1. **Module opener slide** — restate this module's outcome/promise: what will be true for the student by the end of this module specifically.
2. **One intro slide per sub-module**, immediately followed by **one or more slides per lesson within it** — enough slides to actually teach each lesson's content thoroughly (its teaching beat, expanded into real explanation), not compress it into a single bullet.
3. **A closing slide for each lesson's action step** — presented as a clear, on-screen instruction for what the student does now, not buried inside a content slide.
4. **Final wrap-up slide** — restate this module's milestone (the concrete checkpoint that proves it landed) and exactly what the student needs to have done before moving to the next module.

This needs to be a real, thorough teaching deck for this one module — typically 8-20 slides depending on how many sub-modules and lessons this module actually has (err toward more when the module covers real ground). Every slide earns its place with substantive content; a slide with only a bare topic label or one shallow bullet is a failure to fix.`;
}
