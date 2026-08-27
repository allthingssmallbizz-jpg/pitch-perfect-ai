// A project-level discovery fact: which conversion pattern this offer's CTA actually leads to.
// Distinct from the free-text "cta" field (the exact button copy) — this is the structural
// category downstream generators branch real decisions on, most directly the Thank You Page
// generator (src/lib/ai/generators/thankYouPage.ts), which needs to know whether it's confirming
// a call request, an actual purchase, a tripwire (and should pivot into the upsell), or a
// registration (and should confirm a date/time) before it can write the right page at all.
export const FUNNEL_TYPES = [
  { value: "book_call", label: "Book a call" },
  { value: "checkout", label: "Checkout / direct purchase" },
  { value: "tripwire", label: "Tripwire + upsell" },
  { value: "webinar_registration", label: "Webinar / challenge registration" },
] as const;

export type FunnelType = (typeof FUNNEL_TYPES)[number]["value"];

export function getFunnelTypeLabel(value: string): string {
  return FUNNEL_TYPES.find((f) => f.value === value)?.label ?? "Not specified";
}
