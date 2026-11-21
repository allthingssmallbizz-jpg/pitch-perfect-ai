import type { Project } from "@/types/database";
import { formatDiscoveryBlock, PRESENTED_DECK_RULES } from "./shared";
import { parsePptOutline } from "../pptxParser";
import {
  EXPRESS_AUDIENCE_TYPES,
  EXPRESS_FORMATS,
  expressMinutes,
  expressSlideTarget,
  SPEAKING_WORDS_PER_MINUTE,
  type ExpressBrief,
} from "@/lib/express";

// Pitch Perfect Express™ (Agent Piper): a 10-25 slide presentation for a meeting, a speaking
// slot, or a group leader — the same Hook → Story → Offer method as the Signature Webinar, sized
// to the time available and built around ONE clear next step. Output uses the exact same
// "**Slide #: Title**" / on-slide content / speaker notes format as the webinar deck, so preview,
// PowerPoint download, Copy for Gamma, Read Aloud, and Check for Issues all work unchanged.
export const EXPRESS_DECK_CREDIT_COST = 6;
export const EXPRESS_DECK_MAX_OUTPUT_TOKENS = 14000;

export function isExpressDeckIncomplete(content: string, brief?: ExpressBrief): boolean {
  if (!brief) return false;
  return parsePptOutline(content).length < Math.floor(expressSlideTarget(brief) * 0.8);
}

export const EXPRESS_DECK_CONTINUATION_HINT =
  "You stopped before the last slide — keep going in the same format, through the offer, the invitation, and the closing call to action.";

const AUDIENCE_GUIDANCE: Record<ExpressBrief["audienceType"], string> = {
  one: "ONE decision-maker: make it consultative, not a performance. Ask questions they can answer out loud, reflect their situation back, and recommend a next step the way a trusted advisor would. No hype, no theatrical value stacking, no pressure.",
  small_group:
    "A SMALL GROUP (2-15): conversational and interactive — invite a quick show of hands or a short answer early, speak to the group's shared goal, and make the next step easy for the group to agree to together (often: pick a date for a follow-up conversation).",
  room: "A ROOM (16+): energetic and clear — open with a hook that works on a crowd, use one or two simple interaction prompts (raise a hand, say yes), and give ONE simple way to take the next step on the spot (scan a QR code, fill in a card, visit a short link, book at a table).",
};

export function buildExpressDeckPrompt(
  project: Project,
  brief?: ExpressBrief
): string {
  if (!brief) throw new Error("Pitch Perfect Express needs its presentation brief.");
  const format = EXPRESS_FORMATS[brief.format];
  const slides = expressSlideTarget(brief);
  const minutes = expressMinutes(brief);
  const words = minutes * SPEAKING_WORDS_PER_MINUTE;
  const hookSlides = Math.max(2, Math.round(slides * 0.2));
  const offerSlides = Math.max(3, Math.round(slides * 0.3));
  const storySlides = slides - hookSlides - offerSlides;

  return `Build a Pitch Perfect Express™ presentation: a short-form, ${slides}-slide presentation (the "${format.label}" format) that the presenter delivers in about ${minutes} minutes, designed to move THIS specific audience to ONE clear next step. This is not a webinar and not a shortened webinar — it's a different selling situation, so build it for the room described below.

THIS PRESENTATION'S BRIEF (written by the presenter for this occasion — it takes priority over the general business background further down):
- Where and to whom: ${brief.setting}
- Who's in the room and what matters to them: ${brief.audience}
- The problem or opportunity that will make them pay attention: ${brief.problem}
- What the presenter wants them to do at the end (the conversion goal): ${brief.goal}
- What they're inviting the audience to consider (the offer): ${brief.offer}
- Proof the presenter can stand behind: ${brief.proof || "NONE PROVIDED — build credibility from the presenter's experience, understanding of the audience, and clear process instead. Never invent results, testimonials, client counts, or statistics."}
- About the presenter, in their own words: ${brief.aboutYou}
- Audience: ${EXPRESS_AUDIENCE_TYPES[brief.audienceType].label}. ${AUDIENCE_GUIDANCE[brief.audienceType]}
- Time available: about ${minutes} minutes.

STEP 1 — DECIDE THE CONVERSION STRATEGY FIRST (don't output this step; use it to shape every slide): who exactly is in the room, the one thing they care about most, the single belief they need to have to say yes, the one next step that matches the goal above, and the two or three hesitations most likely to stop them. Every slide must serve that strategy. A presentation to one decision-maker should feel completely different from one to 50 people.

STEP 2 — BUILD EXACTLY ${slides} SLIDES using the Pitch Perfect Hook → Story → Offer method, adapted to short form (a suggested emphasis, not a rigid formula — adjust to the room):
1. HOOK (about ${hookSlides} slides): Slide 1 is the title slide — the presentation's real name, built from what this audience wants or the problem they face (never a vague teaser), with the presenter's name underneath. Then capture attention with something that hits THIS audience (a question they're asking themselves, a surprising truth about their situation, or a moment they'll recognize), show you understand their world, and name the problem or opportunity.
2. STORY + VALUE (about ${storySlides} slides): a brief, human introduction of the presenter (who they are and why they care about this audience — only from what they told you, never invented), a short story or example that shows the old way vs. the new way (a mini Epiphany Bridge™: the struggle, the realization, the better way), then the solution — the insight or simple process (usually 3 steps) that gets this audience what they want. Use the proof provided; if there's none, show credibility through expertise, process, and genuine understanding of the audience.
3. OFFER + ACTION (about ${offerSlides} slides): connect the solution to the offer as the natural next step, say plainly what they get and how it works, answer the top hesitations honestly, make the invitation — the exact next step from the brief, worded so it's easy to say yes to — and close on a final slide that repeats the call to action and how to take it (contact, link, QR code, or sign-up).
   - If the goal is a direct purchase of a priced offer AND the audience is a room, you may briefly recap what's included with real values from Discovery, then ask "Although I'm not going to charge you [total value] today, if I were to charge you that, would it be worth it?" on its own slide before the price, which is revealed alone on its own slide. For a meeting, a consultation, a group leader, or any next step that isn't a purchase, skip value stacking and price theatrics entirely — just make a clear, confident recommendation.

FOR EACH SLIDE OUTPUT:
**Slide #: Title**
- On-slide content: 2-4 short bullets (each 4-10 words — what the audience reads at a glance)
- Visual idea: one short line describing an image or visual for this slide (this guides the designer; it is never shown on the slide)
- Speaker notes: what the presenter actually says out loud while this slide is up — natural and conversational, including a one-line transition into the next slide. Keep the total spoken script around ${words} words across all slides (about ${minutes} minutes at a relaxed pace): roughly ${Math.round(words / slides)} words per slide on average, a little more on the story and invitation slides, a little less on the title and closing slides.

Write it for a real person to deliver in a real room: plain language, specific to this audience's world, never generic business-speak that could apply to anyone. Never invent facts, results, testimonials, numbers, or credentials — use only what the brief, the Discovery background, and the presenter's bio actually say, and write [NEEDS: ...] where a fact is genuinely missing.
${PRESENTED_DECK_RULES}

GENERAL BUSINESS BACKGROUND (from this project's Discovery — may be incomplete; use what helps this presentation and ignore what doesn't fit this room):
${formatDiscoveryBlock(project)}`;
}
