import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";
import type { Agent } from "./config";

// Every agent in AGENTS (config.ts) is written as a woman — Sarah, Vicky, Sally, Paige, Ellie,
// Polly, Addie, Olivia, Tessa, Casey, Annie — so these option lists deliberately narrow
// avataaars' full default range (which mixes in masculine hairstyles and beards with equal
// weight) down to feminine-presenting hair and zero facial hair, rather than leaving every
// option unconstrained. Eyes/mouth/eyebrows/clothing/skin tone/hair color stay within the
// style's normal range so each of the 11 agents still lands on a genuinely distinct, expressive
// face — only gender presentation is pinned, not personality or coloring.
const FEMININE_HAIR = [
  "bigHair",
  "bob",
  "bun",
  "curly",
  "curvy",
  "frida",
  "fro",
  "froBand",
  "longButNotTooLong",
  "miaWallace",
  "straight01",
  "straight02",
  "straightAndStrand",
] as const;

const FRIENDLY_MOUTH = ["smile", "twinkle", "default"] as const;
const CONFIDENT_EYES = ["default", "happy", "wink", "side", "squint"] as const;
const EXPRESSIVE_EYEBROWS = ["defaultNatural", "raisedExcitedNatural", "default", "raisedExcited"] as const;
// Glasses only — avataaars' full accessories list also includes "eyepatch," which reads as an
// injury/pirate joke rather than a professional look on an AI agent's face.
const GLASSES = ["prescription01", "prescription02", "round", "sunglasses", "wayfarers"] as const;

// Generated client- and server-side alike (this is plain JS, no Node-only APIs) as an inline
// SVG data URI — no network request, no external image host to go down, no npm cost beyond the
// two @dicebear packages already installed. Seeded by the agent's exact name (not asset type),
// so ppt_outline and webinar_script — both "Agent Polly," the same character covering two
// capabilities — automatically render the identical face, and a given agent's face never
// changes on its own between visits or deploys.
export function getAgentAvatarDataUri(agent: Pick<Agent, "name">): string {
  return createAvatar(avataaars, {
    seed: agent.name,
    top: [...FEMININE_HAIR],
    facialHairProbability: 0,
    mouth: [...FRIENDLY_MOUTH],
    eyes: [...CONFIDENT_EYES],
    eyebrows: [...EXPRESSIVE_EYEBROWS],
    accessories: [...GLASSES],
    accessoriesProbability: 15,
  }).toDataUri();
}
