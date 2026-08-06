import type { Project } from "@/types/database";

// Renders a Project's discovery fields into the block every generator prompt is built on.
// Centralized so "discovery-before-copy" is enforced consistently — every generator sees
// exactly the same facts, and missing fields are explicit rather than silently blank.
export function formatDiscoveryBlock(project: Project): string {
  const field = (label: string, value: string) =>
    `${label}: ${value?.trim() ? value.trim() : "(not provided)"}`;

  return [
    `PROJECT: ${project.name}`,
    field("One Result", project.one_result),
    field("Who it's for", project.who_its_for),
    field("The problem", project.the_problem),
    field("The transformation", project.the_transformation),
    field("Price", project.price),
    field("Bonuses", project.bonuses),
    field("Guarantee", project.guarantee),
    field("Proof", project.proof),
    field("Additional discovery notes", project.discovery_notes),
  ].join("\n");
}
