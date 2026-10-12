import type { Project } from "@/types/database";
import { formatDiscoveryBlock } from "./shared";
import { parsePptOutline } from "../pptxParser";

export const CHALLENGE_DAY_SLIDES_CREDIT_COST = 5;
export const CHALLENGE_DAY_SLIDES_MAX_OUTPUT_TOKENS = 8000;

// Same reasoning as COURSE_MODULE_SLIDES_MIN_ACCEPTABLE_SLIDES: a real day's deck runs roughly
// 8-18 slides per the prompt's own target below, so this floor sits well under that on purpose —
// it's meant to catch Claude compressing the whole day into one or two slides and stopping short,
// not to second-guess a legitimately simple day that lands at 6-7.
export const CHALLENGE_DAY_SLIDES_MIN_ACCEPTABLE_SLIDES = 5;

export function isChallengeDaySlidesIncomplete(content: string): boolean {
  return parsePptOutline(content).length < CHALLENGE_DAY_SLIDES_MIN_ACCEPTABLE_SLIDES;
}

export const CHALLENGE_DAY_SLIDES_CONTINUATION_HINT =
  "You stopped short of a genuinely thorough deck for this one day — it is not done yet. Keep writing through the rest of this day's teaching, the daily action slide, the engagement prompt slide, and the pitch/offer slides if this day calls for them, with the same one-slide-per-real-point pacing as before.";

// Agent Casey's own "outline -> one day's deck" step, the exact same relationship Build Module
// Slides has to the Course Outline: the Challenge Outline is the day-by-day skeleton (teaching
// beat, daily action, engagement prompt, belief being built — see challengeOutline.ts), not the
// finished, presentable material a member actually opens and teaches/records from. Deliberately
// one deck per day rather than one giant deck for the whole challenge, for the same reason Build
// Module Slides is one deck per module: a member delivers one day at a time, and a single
// all-days deck would either be enormous or force compressing real teaching content to fit.
//
// `isFinalDay` and `includePitch` are separate on purpose: the outline always designates the
// LAST day as the pitch day, but a member running this challenge may reasonably want to start
// introducing the offer a day earlier (Day 4 of a 5-day challenge) without necessarily wanting
// the full hard-close there too — so the pitch section's own tone below adapts to whichever is
// true, rather than always writing a single fixed "this is THE pitch" block.
export function buildChallengeDaySlidesPrompt(
  project: Project,
  challengeOutlineContent: string,
  dayIdentifier: string,
  includePitch: boolean,
  isFinalDay: boolean
): string {
  const pitchSection = includePitch
    ? `
6. **Pitch/offer slides, right after the recap** — ${
        isFinalDay
          ? "this is THE pitch day: present the complete paid offer as the obvious next step now that the participant has a real taste of the transformation."
          : "this day is introducing/previewing the paid offer ahead of the challenge's actual final pitch day — build real momentum and desire, but don't force a hard close here; frame it as \"here's what's possible if you want to go further\" rather than the one and only chance to decide."
      } Follow THE STACK REVEAL pacing rule below — never one slide dumping the whole offer, never one slide per item:
   a. One slide connecting what was just taught/accomplished today directly to the paid offer — the obvious next step, not an abrupt pivot.
   b. One slide introducing the core offer alone, with its own value if one was supplied.
   c. Batch any stack items + bonuses from the VALUE STACK discovery data into 1-3 cumulative recap slides (each showing everything revealed so far, growing batch to batch — see this project's Discovery data above for the real items/values; never invent ones that aren't there). Skip this step entirely if the discovery data has no stack items/bonuses.
   d. One slide totaling everything just stacked (the real computed number from Discovery, never invented) — skip if there was nothing to total.
   e. One slide revealing the price, contrasted against that total.
   f. ${
        isFinalDay
          ? "One slide on the guarantee, then a required Two Paths slide — never skipped, never folded into the guarantee or CTA slide: lay out two explicit paths forward. Path one, take everything just taught across this challenge and go try to implement it alone (a genuinely valid choice, they have what they need to attempt it). Path two, decide to work with the presenter/the presenter's team instead, who has already walked this exact path and knows the real blueprint, putting them in the strongest position to actually get the result faster and with less trial and error. Only after that, a final slide with a single clear call to action for enrolling now."
          : "A single clear call to action for enrolling now, briefly noting there's still time before the challenge wraps if they want to finish it first."
      }
`
    : "";

  return `Build a full slide-by-slide teaching deck (titles + on-slide content + speaker notes) for ONE SPECIFIC DAY of an already-built multi-day Challenge — the actual, presentable, recordable daily session material, not a summary of the outline.

${formatDiscoveryBlock(project)}

FULL CHALLENGE OUTLINE THIS DAY BELONGS TO (for context and to find the right day):
${challengeOutlineContent}

THE DAY TO BUILD SLIDES FOR: "${dayIdentifier}"${isFinalDay ? " (the challenge's final day)" : ""}

Find that exact day in the challenge outline above (match by its number). Build slides for ONLY that day — do not build slides for any other day, and do not summarize the rest of the challenge.

Every example, scenario, number, and piece of language must be specific to THIS project's actual niche, industry, and audience from Discovery above, never generic business-speak that could apply to any challenge.

For each slide output:
- **Slide #: Title** — a real, specific headline reflecting what's actually taught or asked on THIS slide, written the way a participant would actually read a slide title — never a bare structural label copied verbatim from the outline or this deck's own required structure ("Teaching Beat," "Daily Action," "Engagement Prompt," "Pitch"). A participant looking at the slide should never be able to tell it's "the action slide" just from its title — name the actual thing being taught or the actual action being asked for instead.
- **On-slide content**: 3-5 SHORT bullets — each a scannable cue phrase a viewer reads in 2-3 seconds (roughly 4-10 words), never a full sentence. If what you're trying to say needs more than one breath to read, it belongs in speaker notes instead.
- **Speaker notes**: this is where the real TEACHING MOMENT lives — a continuous, natural-sounding passage (5-8 sentences) a presenter actually says live or on video to teach this slide's point for real, not a bare restatement of the bullets. Cap it at one concrete, niche-grounded example per slide so it stays usable live. Write it as one flowing thought a real presenter would SAY out loud — never as an annotated breakdown ("First bullet:", "For the next point...").
  Still must correlate to the slide: a note unrelated to its own bullets is as much a failure as one that just repeats them word-for-word.

Readability rule: a viewer should get a slide's point on a 3-second glance. If a slide needs real reading to parse — a wall of text, a bullet that's actually a paragraph, more than 5 bullets — that slide has failed, no matter how accurate the content is.

Structure THIS DAY's deck as:
1. **Day opener slide** — restate this day's theme/promise from the outline: what today is about and why it matters toward the challenge's overall transformation.
2. **Teaching slides** — expand this day's teaching beat into enough SLIDES to actually teach it thoroughly (break a dense beat into several focused slides, each with its own short point — never into one slide with more bullets crammed on).
3. **The daily action slide** — presented as a clear, on-screen instruction for the one specific, completable task the participant does today (the actual engine of the challenge — the quick win).
4. **Engagement prompt slide** — the specific question or share-in-the-group prompt from the outline for this day.
5. **Recap slide** — what the participant now has/knows/can do after today, tying back to the belief this day was meant to build.${pitchSection}

THE STACK REVEAL (only applies if pitch slides are included above) — a batched, CUMULATIVE recap, never all stack items at once and never one slide per item. Word a stack item (part of the core offer) and a bonus (a separate extra) differently when introducing each, even within the same batch.

This needs to be a real, thorough teaching deck for this one day — typically 8-18 slides depending on how much the day's teaching beat actually covers (err toward MORE, shorter slides over fewer, denser ones), plus the pitch slides above when included. Every slide earns its place with a real, specific, niche-grounded point; a slide with a bare topic label, or a slide crammed with more text than a 3-second glance can take in, are both a failure to fix.`;
}
