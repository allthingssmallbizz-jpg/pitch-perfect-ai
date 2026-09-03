import type { Project } from "@/types/database";

// The discovery fields DiscoveryForm.tsx marks with a required asterisk — the single source
// of truth for "is this project's brief actually complete," shared by the form's own
// server-side validation (updateProjectDiscovery) and the generate-page gate
// (projectNeedsDiscovery) so neither can drift out of sync with what the UI actually asks for.
// Was 14 fields; a student made it all the way through Discovery, hit "Save," and only then got
// bounced back for gaps in fields that were never marked required in the first place — Aaron's
// fix was making every real question mandatory. Only "Additional discovery notes" (a genuine
// freeform catch-all, not a specific question) stays optional now.
// `as const satisfies` (not a plain `{ key: keyof Project; label: string }[]` annotation) so
// RequiredFieldKey below narrows to just these literal keys instead of widening to every key on
// Project — that's what lets projectNeedsDiscovery accept a lean `.select("business_name,
// industry, ...")` (see the agent landing page's account-wide discovery gate) instead of forcing
// every caller to fetch the full row.
export const REQUIRED_DISCOVERY_FIELDS = [
  { key: "business_name", label: "Business or brand name" },
  { key: "industry", label: "Industry / niche" },
  { key: "product", label: "Product or service" },
  { key: "offer_name", label: "Webinar / offer name" },
  { key: "audience", label: "Target audience" },
  { key: "existing_assets", label: "Existing marketing assets" },
  { key: "awareness_level", label: "Awareness level" },
  { key: "pain_points", label: "Biggest pain points" },
  { key: "false_beliefs", label: "False beliefs / objections" },
  { key: "desired_transformation", label: "Desired transformation" },
  { key: "category", label: "Market category" },
  { key: "enemy", label: "The enemy / villain" },
  { key: "differentiator", label: "Primary differentiator" },
  { key: "competitive_alternatives", label: "Competitive alternatives" },
  { key: "unique_mechanism", label: "Unique mechanism" },
  { key: "core_promise", label: "Core promise" },
  { key: "outcomes", label: "Top outcomes / benefits" },
  { key: "proof", label: "Proof available" },
  { key: "price", label: "Price point" },
  { key: "guarantee", label: "Guarantee" },
  { key: "bonuses", label: "Bonuses (if any)" },
  { key: "scarcity_urgency", label: "Scarcity / urgency" },
  { key: "cta", label: "Primary call to action" },
  { key: "funnel_type", label: "Funnel type" },
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

// Used for the Discovery form's own soft, dismissible "you left some blank" warning on save —
// distinct from REQUIRED_DISCOVERY_FIELDS only in principle now (it used to add proof/guarantee/
// bonuses/scarcity_urgency on top of a shorter required list; now that those are themselves
// required, there's nothing left to add). Kept as its own list/helper rather than collapsed into
// REQUIRED_DISCOVERY_FIELDS directly since the two serve different jobs — one gates reaching a
// generator, the other just nudges before a save — and a future required field that shouldn't
// also trigger this softer warning (or vice versa) would only need to change one of the two.
export const RECOMMENDED_DISCOVERY_FIELDS: { key: keyof Project; label: string }[] = [...REQUIRED_DISCOVERY_FIELDS];

export function getMissingRecommendedFieldLabels(fields: Record<string, string>): string[] {
  return RECOMMENDED_DISCOVERY_FIELDS.filter(({ key }) => !fields[key]?.trim()).map((f) => f.label);
}
