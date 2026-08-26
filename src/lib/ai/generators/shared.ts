import type { AssetType, Project } from "@/types/database";

// Renders a Project's full discovery brief into the block every generator prompt is built on.
// Centralized so "discovery-before-copy" is enforced consistently — every generator sees
// exactly the same facts, and missing fields are explicit rather than silently blank.
// Grouped to match the Discovery -> Customer Awareness -> Positioning -> Value Proposition ->
// Offer sequence the Pitch Perfect playbooks require before writing any copy.
export function formatDiscoveryBlock(project: Project): string {
  const field = (label: string, value: string) =>
    `${label}: ${value?.trim() ? value.trim() : "(not provided)"}`;

  return [
    `PROJECT: ${project.name}`,
    "",
    "DISCOVERY",
    field("Business / brand name", project.business_name),
    field("Industry / niche", project.industry),
    field("Product or service", project.product),
    field("Webinar / offer name", project.offer_name),
    field("Target audience", project.audience),
    field("Existing marketing assets", project.existing_assets),
    "",
    "CUSTOMER AWARENESS",
    field("Awareness level", project.awareness_level),
    field("Biggest pain points", project.pain_points),
    field("False beliefs / objections", project.false_beliefs),
    field("Desired transformation", project.desired_transformation),
    "",
    "POSITIONING",
    field("Market category", project.category),
    field("The enemy / villain", project.enemy),
    field("Primary differentiator", project.differentiator),
    field("Competitive alternatives", project.competitive_alternatives),
    "",
    "VALUE PROPOSITION",
    field("Unique mechanism", project.unique_mechanism),
    field("Core promise", project.core_promise),
    field("Top outcomes / benefits", project.outcomes),
    field("Proof available", project.proof),
    "",
    "OFFER",
    field("Price point", project.price),
    field("Guarantee", project.guarantee),
    field("Bonuses", project.bonuses),
    field("Scarcity / urgency", project.scarcity_urgency),
    field("Primary call to action", project.cta),
    "",
    field("Additional discovery notes", project.discovery_notes),
  ].join("\n");
}

export interface PriorGeneration {
  assetType: AssetType;
  content: string;
}

// Long assets (a 60-90 slide PPT outline especially) would otherwise balloon every later
// generation's input cost just to carry context forward — this caps each one to its opening
// section, which is where the headline/hook/Big Idea actually live.
const PRIOR_GENERATION_CHAR_LIMIT = 4000;

function humanizeAssetType(assetType: AssetType): string {
  return assetType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Every asset for a project must share the same Big Idea, Unique Mechanism, headline/hook
// language, and offer framing as whatever else has already been generated for it, per the
// Campaign Architecture Operating Manual (09-campaign-architecture.md) — not reinvent its own
// narrative on every call. That rule is already in every generator's system prompt (it's part of
// the knowledge library buildSystemPrompt loads), but an instruction to "stay consistent with
// prior assets" does nothing if the model is never actually shown what those assets said — this
// is what makes it real. Returns "" when the project has no other completed generations yet
// (nothing to be consistent with on the very first asset).
export function formatPriorGenerationsBlock(priorGenerations: PriorGeneration[]): string {
  if (priorGenerations.length === 0) return "";

  const sections = priorGenerations.map(({ assetType, content }) => {
    const truncated =
      content.length > PRIOR_GENERATION_CHAR_LIMIT
        ? `${content.slice(0, PRIOR_GENERATION_CHAR_LIMIT)}\n[...truncated for length — the full asset is in this project's Version History]`
        : content;
    return `### ${humanizeAssetType(assetType)}\n${truncated}`;
  });

  return [
    "",
    "EXISTING ASSETS ALREADY GENERATED FOR THIS PROJECT",
    "Reuse and build on these — the same Big Idea, Unique Mechanism, headline/hook language, and offer framing — rather than inventing a different core narrative. This new asset should feel like the next step in the same story these assets already tell, not a fresh pitch that happens to share the same facts.",
    "",
    sections.join("\n\n"),
  ].join("\n");
}
