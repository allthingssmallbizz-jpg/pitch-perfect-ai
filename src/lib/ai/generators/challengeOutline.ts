import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";
import { parseChallengeDayList } from "../challengeDays";

export const CHALLENGE_CREDIT_COST = 3;
export const CHALLENGE_MAX_OUTPUT_TOKENS = 5000;

export const CHALLENGE_LENGTHS = ["3", "5"] as const;
export type ChallengeLength = (typeof CHALLENGE_LENGTHS)[number];
export function isChallengeLength(value: string): value is ChallengeLength {
  return (CHALLENGE_LENGTHS as readonly string[]).includes(value);
}

// Reported: a member asked for a 5-day challenge and got only 4 — Claude had judged itself
// "done" a day short (stop_reason "end_turn", not "max_tokens"), the same class of failure
// PPT Outline's own PPT_OUTLINE_MIN_ACCEPTABLE_SLIDES catches for a fixed slide-count floor.
// This can't use a fixed floor the same way, though — a genuinely finished 3-day challenge
// must never be flagged incomplete just for having fewer than 5 days. So this checks the
// ACTUAL requested length (extra.challengeLength, the same value buildChallengeOutlinePrompt
// above was given) against how many of parseChallengeDayList's real, numbered days actually
// came back, rather than any one fixed number. Falls back to treating a missing/unrecognized
// challengeLength as "5" — the prompt's own default — so this still catches a bare "it stopped
// early" even on a request that somehow arrives without it.
export function isChallengeOutlineIncomplete(content: string, extra?: { challengeLength?: string }): boolean {
  const requested = Number(extra?.challengeLength && isChallengeLength(extra.challengeLength) ? extra.challengeLength : "5");
  return parseChallengeDayList(content).length < requested;
}

export const CHALLENGE_OUTLINE_CONTINUATION_HINT =
  "You stopped short of the full requested challenge length — at least one day is still missing. Keep writing through the remaining day(s) with the exact same `Day #: Theme` heading format and the same depth (teaching beat, daily action, engagement prompt, belief being built) as every day already written, then the final day's pitch section and the engagement mechanics section if you haven't reached those yet.";

// The other classic engagement-funnel format alongside a Webinar or VSL: a free multi-day
// "challenge" that delivers a real quick win each day, builds a habit of showing up, and pitches
// on the final day once trust and momentum are highest — rather than asking for a buying decision
// cold. Distinct enough in structure (daily beats, not one continuous arc) that it deserved its
// own generator instead of being improvised out of the Webinar Outline.
export function buildChallengeOutlinePrompt(
  project: Project,
  priorGenerations: PriorGeneration[] = [],
  challengeLength: ChallengeLength = "5"
): string {
  return `Build a full multi-day Challenge Outline for the project below — a free, guided challenge that delivers a real result over several days, builds a daily habit of showing up, and makes the offer on the final day once trust and momentum are highest.

${formatDiscoveryBlock(project)}
${formatPriorGenerationsBlock(priorGenerations)}

THE LENGTH HAS ALREADY BEEN CHOSEN: this is a ${challengeLength}-DAY challenge — build exactly ${challengeLength} days, no more and no fewer, scaling how much ground each day covers to fit (a 3-day challenge still needs to deliver a complete, satisfying arc in fewer days — don't pad it to feel like a 5-day challenge, and don't try to cram a 5-day amount of teaching into 3 rushed days either).

Then produce the outline in this structure:

1. **Challenge name and promise** — a specific, outcome-driven name (not just "The ${challengeLength}-Day Challenge") and a one-sentence promise of exactly what a participant will have, know, or be able to do by the end, if they show up and do the daily action.

2. **Day 0 — Welcome / Kickoff** (pre-Day-1 orientation, sent right after registration): welcome message, what to expect across the challenge, the single daily habit that makes this work (e.g. "show up live at 9am" or "do the day's action before moving on"), and one quick task to build immediate momentum before Day 1 even starts.

3. **One block per challenge day — exactly ${challengeLength} of them, numbered Day 1 through Day ${challengeLength}**. Head EACH day's block with its own line formatted EXACTLY as \`Day #: Theme\` (e.g. \`Day 1: Discover Your Signature Framework\`) — one day per line, nothing else on that line, theme stated as a real headline not a bare topic label. A member later picks from this exact heading when telling Casey which day to build slides for, so it has to be a clean, literal line, not buried in a sentence. Under that heading, for EACH day include:
   - **Teaching beat** — the core lesson/insight for the day (bullet beats, not a full script — this is a skeleton to build a live session or video from).
   - **The daily action** — one specific, completable task the participant does that day. This is the actual engine of the challenge: the "quick win" that makes tomorrow's content land and keeps them showing up.
   - **Engagement prompt** — a specific question or share-in-the-group prompt for that day (challenges live or die on participation, not passive consumption).
   - **Belief being built** — which false belief this day chips away at, or which piece of the core promise this day makes more real/believable.

4. **Final day — Pitch day**: how the last day's content naturally transitions from "here's what you've accomplished over these ${challengeLength} days" into presenting the paid offer as the obvious next step — the value stack, then — right after the total value and right before the price — the required tie-down question worded exactly "Although I'm not going to charge you [total value] today, if I were to charge you that, would it be worth it?", the guarantee, and a single clear CTA — plus how to briefly re-pitch it in the day(s) immediately after the challenge ends for anyone who didn't decide yet (the enrollment window, not just one moment). Right before that final CTA, include a required Two Paths beat — never skipped, never folded into the guarantee: lay out two explicit paths forward. Path one, take everything just taught over this challenge and go try to implement it alone (a genuinely valid choice, they have what they need to attempt it). Path two, decide to work with the presenter/the presenter's team instead, who has already walked this exact path and knows the real blueprint, putting them in the strongest position to actually get the result faster and with less trial and error.

5. **Engagement mechanics** — a short section on what actually keeps completion rates high: recommended delivery format (live vs. pre-recorded, a private group vs. email-only), accountability mechanism (daily check-ins, a leaderboard, a completion badge), and how prizes/recognition could be used if relevant to this niche.

Keep each day to a one-screen block: a one-line objective followed by bullet beats — not full prose script. This is a skeleton a presenter builds daily content and prompts from, not a word-for-word script.`;
}
