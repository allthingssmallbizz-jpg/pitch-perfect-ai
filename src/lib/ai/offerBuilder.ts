// "Offer Builder" — for a member who doesn't know what to name their webinar/offer yet, what to
// charge, or how to close, this drafts a starter offer from whatever discovery is already filled
// in (industry, audience, product, unique mechanism, pain points, etc.), so they have something
// concrete to tweak instead of a blank page. Same review-before-insert pattern as "Import from
// your website" (src/lib/ai/websiteImport.ts) — every draft is shown for review, nothing is
// invented as fact (unlike proof/testimonials elsewhere, a creative name or a suggested price is
// explicitly a starting draft, not a claim, so the model is free to be genuinely creative here).
import type { Project } from "@/types/database";
import { formatDiscoveryBlock } from "./generators/shared";

export const OFFER_BUILDER_CREDIT_COST = 2;
export const OFFER_BUILDER_MAX_OUTPUT_TOKENS = 1500;

// The discovery fields this drafts directly — reviewed and inserted the same way website import
// works. Excludes "reasoning" output (see below), which explains the price/CTA choice but isn't
// itself a field value to insert anywhere.
export const OFFER_BUILDER_FIELD_KEYS = [
  "offer_name",
  "core_promise",
  "outcomes",
  "price",
  "guarantee",
  "bonuses",
  "cta",
] as const;

export type OfferBuilderFieldKey = (typeof OFFER_BUILDER_FIELD_KEYS)[number];

export const OFFER_BUILDER_FIELD_LABELS: Record<OfferBuilderFieldKey, string> = {
  offer_name: "Webinar / offer name",
  core_promise: "Core promise",
  outcomes: "Top outcomes / benefits",
  price: "Price point",
  guarantee: "Guarantee",
  bonuses: "Bonuses / demo stack",
  cta: "Primary call to action (closing mechanism)",
};

export function buildOfferBuilderPrompt(
  project: Project,
  extraContext: string
): { system: string; user: string } {
  const fieldList = OFFER_BUILDER_FIELD_KEYS.map((k) => `"${k}"`).join(", ");

  const system = `You are a direct-response offer strategist helping a course creator/coach/expert who doesn't yet know what to name their webinar, what to charge, or how to close clients build a first complete draft of their offer.

CRITICAL RULES:
1. Output ONLY a single valid JSON object, nothing before or after it — no markdown code fences, no commentary.
2. The object must have exactly these keys, every one present as a string: ${fieldList}, plus "pricing_reasoning" and "closing_mechanism_reasoning".
3. Unlike a "just the facts" tool, this one is explicitly a creative brainstorm the member will tweak — be genuinely inventive with "offer_name" (witty, specific, memorable — not generic like "Success Blueprint"), and propose a real, usable draft for every field even from thin discovery input. Never leave a field blank just because little was supplied; make a strong, reasonable, clearly-a-draft suggestion instead.
4. "price" and "bonuses"/"guarantee" should still be grounded in what's realistic for the stated industry/audience/price sensitivity — don't propose a $50k price for a $47/month mass-market niche or vice versa.
5. "cta" is the recommended closing mechanism, matched to the niche and price tier, not a generic "Learn More". Choose from real closing patterns and pick the one that actually fits:
   - High-ticket coaching/consulting/agency services (roughly $2k+, or anything requiring a real conversation to qualify/close) → a sales-assisted close: "Book a call", "Apply now", "Schedule your strategy session"
   - Local/relationship-driven services where trust and a specific situation matter (e.g. a realtor helping people sell their home, a financial advisor, a contractor) → "Book a call" / "Schedule a consultation" even at a lower price point, because the close genuinely depends on a conversation about their specific situation
   - Low-to-mid ticket digital product, course, or one-time program (roughly under $500-$1,000) → a direct self-serve checkout: "Enroll now", "Get instant access", "Buy now"
   - Recurring community, coaching membership, or ongoing access model → "Join the membership", "Join for $X/month"
   - B2B/enterprise → "Schedule a demo", "Request a proposal"
   State the reasoning in "closing_mechanism_reasoning" (2-3 sentences: why this mechanism fits this specific niche/price/audience, not a generic explanation of the category).
6. "pricing_reasoning" (2-4 sentences): explain why the suggested price fits — reference the value stack/outcomes, what comparable offers in this space charge, and the customer value equation (perceived transformation vs. investment) rather than just picking a round number.
7. Keep each field value tight and usable as-is in a form field — "outcomes" and "bonuses" as short bulleted lists (using "- " line prefixes), everything else 1-2 sentences.`;

  const user = `PROJECT CONTEXT (whatever discovery has been filled in so far — may be sparse):
${formatDiscoveryBlock(project)}

${extraContext.trim() ? `ADDITIONAL CONTEXT FROM THE MEMBER (what they said when asked if they have anything specific in mind):\n"""\n${extraContext.trim()}\n"""\n` : ""}
Draft a complete starter offer: a creative/witty name, core promise, outcomes, price, guarantee, bonuses (demo/value stack), and the single best-fit closing mechanism for this specific niche — with your reasoning for the price and the closing mechanism. Return the JSON object now.`;

  return { system, user };
}

// Defensive parse, same approach as parseWebsiteImportResponse — malformed output degrades to
// empty fields rather than throwing, since a failed draft should read as "nothing suggested," not
// crash the dialog.
export function parseOfferBuilderResponse(raw: string): {
  fields: Record<OfferBuilderFieldKey, string>;
  pricingReasoning: string;
  closingMechanismReasoning: string;
} {
  const emptyFields = Object.fromEntries(OFFER_BUILDER_FIELD_KEYS.map((k) => [k, ""])) as Record<
    OfferBuilderFieldKey,
    string
  >;
  const empty = { fields: emptyFields, pricingReasoning: "", closingMechanismReasoning: "" };

  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```[a-z]*\n?/i, "").replace(/\n?```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== "object") return empty;

  const obj = parsed as Record<string, unknown>;
  const fields = { ...emptyFields };
  for (const key of OFFER_BUILDER_FIELD_KEYS) {
    const value = obj[key];
    if (typeof value === "string") fields[key] = value.trim();
  }

  return {
    fields,
    pricingReasoning: typeof obj.pricing_reasoning === "string" ? obj.pricing_reasoning.trim() : "",
    closingMechanismReasoning:
      typeof obj.closing_mechanism_reasoning === "string" ? obj.closing_mechanism_reasoning.trim() : "",
  };
}
