import type { Project } from "@/types/database";

// The discovery fields DiscoveryForm.tsx marks with a required asterisk — the single source
// of truth for "is this project's brief actually complete," shared by the form's own
// server-side validation (updateProjectDiscovery) and the generate-page gate
// (projectNeedsDiscovery) so neither can drift out of sync with what the UI actually asks for.
// `as const satisfies` (not a plain `{ key: keyof Project; label: string }[]` annotation) so
// RequiredFieldKey below narrows to just these 14 literal keys instead of widening to every key
// on Project — that's what lets projectNeedsDiscovery accept a lean `.select("business_name,
// industry, ...")` (see the agent landing page's account-wide discovery gate) instead of forcing
// every caller to fetch the full row.
export const REQUIRED_DISCOVERY_FIELDS = [
  { key: "business_name", label: "Business or brand name" },
  { key: "industry", label: "Industry / niche" },
  { key: "product", label: "Product or service" },
  { key: "audience", label: "Target audience" },
  { key: "awareness_level", label: "Awareness level" },
  { key: "pain_points", label: "Biggest pain points" },
  { key: "desired_transformation", label: "Desired transformation" },
  { key: "category", label: "Market category" },
  { key: "differentiator", label: "Primary differentiator" },
  { key: "unique_mechanism", label: "Unique mechanism" },
  { key: "core_promise", label: "Core promise" },
  { key: "outcomes", label: "Top outcomes / benefits" },
  { key: "price", label: "Price point" },
  { key: "cta", label: "Primary call to action" },
] as const satisfies { key: keyof Project; label: string }[];

type RequiredFieldKey = (typeof REQUIRED_DISCOVERY_FIELDS)[number]["key"];

// A project is "ready to generate from" once every required discovery field is filled in —
// otherwise a generator has gaps to work from and comes back with something like "I don't have
// enough information about your business," with no indication a form was ever supposed to be
// completed. Used to gate every entry point into a generator (new project, an existing
// project's generate page, the "generate for an existing project" list on an agent's landing
// page) regardless of how someone got there.
export function projectNeedsDiscovery(project: Pick<Project, RequiredFieldKey>): boolean {
  return REQUIRED_DISCOVERY_FIELDS.some(({ key }) => !String(project[key] ?? "").trim());
}

// Same required-field list, applied to raw form field values (before they're saved) — lets
// updateProjectDiscovery reject an incomplete save with a specific, actionable list instead of
// silently persisting a half-finished brief that projectNeedsDiscovery would just bounce later.
export function getMissingDiscoveryFieldLabels(fields: Record<string, string>): string[] {
  return REQUIRED_DISCOVERY_FIELDS.filter(({ key }) => !fields[key]?.trim()).map((f) => f.label);
}

// Beyond the hard-required fields above, these meaningfully weaken a generated webinar/VSL/sales
// copy's Offer and Certainty beats when left blank — but are never added to the required list
// above, because an authentically blank one is a legitimate answer, not a mistake (a business
// with no real bonuses or urgency mechanism shouldn't be forced to invent one; webinarOutline.ts's
// prompt already handles "no authentic urgency mechanism supplied" gracefully). So this list is
// used only for a soft, dismissible warning on the Discovery form itself when a member tries to
// save with one of these still blank — never to block reaching a generator the way
// projectNeedsDiscovery does with REQUIRED_DISCOVERY_FIELDS.
export const RECOMMENDED_DISCOVERY_FIELDS: { key: keyof Project; label: string }[] = [
  ...REQUIRED_DISCOVERY_FIELDS,
  { key: "proof", label: "Proof (case studies, testimonials, results)" },
  { key: "guarantee", label: "Guarantee" },
  { key: "bonuses", label: "Bonuses" },
  { key: "scarcity_urgency", label: "Scarcity / urgency" },
];

export function getMissingRecommendedFieldLabels(fields: Record<string, string>): string[] {
  return RECOMMENDED_DISCOVERY_FIELDS.filter(({ key }) => !fields[key]?.trim()).map((f) => f.label);
}
