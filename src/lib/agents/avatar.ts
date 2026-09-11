import { createAvatar } from "@dicebear/core";
import { bottts } from "@dicebear/collection";
import type { Agent } from "./config";

// Robot mascot faces (DiceBear's "bottts" style) rather than human portraits — Aaron's call
// after reviewing several human-illustrated styles and preferring these: each agent gets a
// distinct color, head shape, eyes, and mouth, and it leans into what these actually are (AI
// agents) instead of trying to pass as a person. No option tuning needed the way the earlier
// human-style avatars required (no gendered hairstyles/facial hair to constrain) — bottts'
// own default range already reads as friendly and varied across all 11 agents.
//
// Generated client- and server-side alike (this is plain JS, no Node-only APIs) as an inline
// SVG data URI — no network request, no external image host to go down, no npm cost beyond the
// two @dicebear packages already installed. Seeded by the agent's exact name (not asset type),
// so ppt_outline and webinar_script — both "Agent Polly," the same character covering two
// capabilities — automatically render the identical mascot, and a given agent's face never
// changes on its own between visits or deploys.
export function getAgentAvatarDataUri(agent: Pick<Agent, "name">): string {
  return createAvatar(bottts, { seed: agent.name }).toDataUri();
}
