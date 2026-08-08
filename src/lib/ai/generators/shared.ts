import type { Project } from "@/types/database";

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
