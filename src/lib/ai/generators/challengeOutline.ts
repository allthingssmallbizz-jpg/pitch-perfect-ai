import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";

export const CHALLENGE_CREDIT_COST = 3;
export const CHALLENGE_MAX_OUTPUT_TOKENS = 5000;

export const CHALLENGE_LENGTHS = ["3", "5"] as const;
export type ChallengeLength = (typeof CHALLENGE_LENGTHS)[number];
export function isChallengeLength(value: string): value is ChallengeLength {
  return (CHALLENGE_LENGTHS as readonly string[]).includes(value);
}

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

4. **Final day — Pitch day**: how the last day's content naturally transitions from "here's what you've accomplished this week" into presenting the paid offer as the obvious next step — the value stack, the guarantee, and a single clear CTA — plus how to briefly re-pitch it in the day(s) immediately after the challenge ends for anyone who didn't decide yet (the enrollment window, not just one moment).

5. **Engagement mechanics** — a short section on what actually keeps completion rates high: recommended delivery format (live vs. pre-recorded, a private group vs. email-only), accountability mechanism (daily check-ins, a leaderboard, a completion badge), and how prizes/recognition could be used if relevant to this niche.

Keep each day to a one-screen block: a one-line objective followed by bullet beats — not full prose script. This is a skeleton a presenter builds daily content and prompts from, not a word-for-word script.`;
}
