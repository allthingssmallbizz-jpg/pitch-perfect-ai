import type { AssetType } from "@/types/database";

export const CHALLENGE_ASSET_TYPES: AssetType[] = ["challenge_outline", "challenge_day_slides"];

// Pulls the real, member-facing list of challenge days out of an already-generated Challenge
// Outline (challenge_outline) — used to replace a free-text "which day?" input on Build Day
// Slides with a dropdown of the challenge's actual days, the same reason parseCourseModuleList
// exists for Cora's Build Module Slides. Day 0 (the pre-Day-1 welcome/kickoff — see
// challengeOutline.ts) is deliberately excluded: it's an orientation message, not a day with its
// own teaching beat/action/engagement prompt to build a slide deck from.
//
// The prompt (challengeOutline.ts) requires a strict `Day #: Theme` line per day specifically so
// this stays reliable, and tolerates the usual markdown drift (bullet/number prefixes, a markdown
// heading's `#`s, bold markers, a missing colon) the same way parseCourseModuleList does. An
// outline generated before that instruction existed may not have used a clean standalone line for
// each day at all (the day's theme could've landed as a separate bullet underneath a bare "Day 1"
// divider, or some other shape entirely) — reported as the dropdown not showing up and being stuck
// typing the day in free text. This can't reliably reconstruct a day it truly isn't labeled on its
// own line anywhere, so the real fix for an outline that old is a one-time Regenerate; this is
// just making sure every outline generated FROM NOW ON parses reliably, with headroom for minor
// drift even then.
export interface ChallengeDayRef {
  number: number;
  title: string;
}

const DAY_LINE = /^(?:#{1,6}\s*)?(?:[-*]\s*)?(?:\d+[.)]\s*)?\**\s*day\s+(\d+)\s*[:.\-–—]?\s*(.*?)\**\s*$/i;

export function parseChallengeDayList(outlineContent: string): ChallengeDayRef[] {
  const seen = new Map<number, ChallengeDayRef>();
  for (const rawLine of outlineContent.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.length > 100) continue;
    const match = line.match(DAY_LINE);
    if (!match) continue;
    const number = Number(match[1]);
    if (!Number.isFinite(number) || number < 1 || seen.has(number)) continue; // Day 0 excluded, first mention wins
    const rest = match[2].trim();
    seen.set(number, { number, title: rest ? `Day ${number}: ${rest}` : `Day ${number}` });
  }
  return [...seen.values()].sort((a, b) => a.number - b.number);
}
