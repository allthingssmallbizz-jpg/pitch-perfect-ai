import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";

export const CHALLENGE_CREDIT_COST = 3;
export const CHALLENGE_MAX_OUTPUT_TOKENS = 5000;

// The other classic engagement-funnel format alongside a Webinar or VSL: a free multi-day
// "challenge" that delivers a real quick win each day, builds a habit of showing up, and pitches
// on the final day once trust and momentum are highest — rather than asking for a buying decision
// cold. Distinct enough in structure (daily beats, not one continuous arc) that it deserved its
// own generator instead of being improvised out of the Webinar Outline.
export function buildChallengeOutlinePrompt(project: Project, priorGenerations: PriorGeneration[] = []): string {
  return `Build a full multi-day Challenge Outline for the project below — a free, guided challenge that delivers a real result over several days, builds a daily habit of showing up, and makes the offer on the final day once trust and momentum are highest.

${formatDiscoveryBlock(project)}
${formatPriorGenerationsBlock(priorGenerations)}

FIRST, decide the length: choose either a 3-day or 5-day challenge based on how much ground the transformation needs to cover and how the offer's price point/complexity was described — state which you chose and why in one line at the top. Default to 5 days unless the transformation is narrow enough to genuinely complete in 3.

Then produce the outline in this structure:

1. **Challenge name and promise** — a specific, outcome-driven name (not just "The 5-Day Challenge") and a one-sentence promise of exactly what a participant will have, know, or be able to do by the end, if they show up and do the daily action.

2. **Day 0 — Welcome / Kickoff** (pre-Day-1 orientation, sent right after registration): welcome message, what to expect across the challenge, the single daily habit that makes this work (e.g. "show up live at 9am" or "do the day's action before moving on"), and one quick task to build immediate momentum before Day 1 even starts.

3. **One block per challenge day** (3 or 5, per your choice above). For EACH day, include:
   - **Day theme** — the one thing this day is about, tied to a specific step toward the transformation, not a generic topic.
   - **Teaching beat** — the core lesson/insight for the day (bullet beats, not a full script — this is a skeleton to build a live session or video from).
   - **The daily action** — one specific, completable task the participant does that day. This is the actual engine of the challenge: the "quick win" that makes tomorrow's content land and keeps them showing up.
   - **Engagement prompt** — a specific question or share-in-the-group prompt for that day (challenges live or die on participation, not passive consumption).
   - **Belief being built** — which false belief this day chips away at, or which piece of the core promise this day makes more real/believable.

4. **Final day — Pitch day**: how the last day's content naturally transitions from "here's what you've accomplished this week" into presenting the paid offer as the obvious next step — the value stack, the guarantee, and a single clear CTA — plus how to briefly re-pitch it in the day(s) immediately after the challenge ends for anyone who didn't decide yet (the enrollment window, not just one moment).

5. **Engagement mechanics** — a short section on what actually keeps completion rates high: recommended delivery format (live vs. pre-recorded, a private group vs. email-only), accountability mechanism (daily check-ins, a leaderboard, a completion badge), and how prizes/recognition could be used if relevant to this niche.

Keep each day to a one-screen block: a one-line objective followed by bullet beats — not full prose script. This is a skeleton a presenter builds daily content and prompts from, not a word-for-word script.`;
}
