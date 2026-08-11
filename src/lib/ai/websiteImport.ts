// "Import from your website" — reads a member's own site and drafts as many of the discovery
// form's fields as the site actually supports, so someone with an existing business doesn't have
// to type their whole offer from scratch. Deliberately conservative: every field the website
// doesn't clearly support comes back empty rather than invented, since a wrong guess (a fake
// price, a made-up guarantee) is worse than a blank field the member fills in themselves.

export const WEBSITE_IMPORT_CREDIT_COST = 3;
export const WEBSITE_IMPORT_MAX_OUTPUT_TOKENS = 3000;

// Every discovery field a website could plausibly speak to — excludes "name" (the project's own
// label, not a discovery answer) and "mode" (a generation setting, not business info).
export const WEBSITE_IMPORT_FIELD_KEYS = [
  "business_name",
  "industry",
  "product",
  "audience",
  "existing_assets",
  "awareness_level",
  "pain_points",
  "false_beliefs",
  "desired_transformation",
  "category",
  "enemy",
  "differentiator",
  "competitive_alternatives",
  "unique_mechanism",
  "core_promise",
  "outcomes",
  "proof",
  "price",
  "guarantee",
  "bonuses",
  "scarcity_urgency",
  "cta",
  "discovery_notes",
] as const;

export type WebsiteImportFieldKey = (typeof WEBSITE_IMPORT_FIELD_KEYS)[number];

export const WEBSITE_IMPORT_FIELD_LABELS: Record<WebsiteImportFieldKey, string> = {
  business_name: "Business or brand name",
  industry: "Industry / niche",
  product: "Product or service",
  audience: "Target audience",
  existing_assets: "Existing marketing assets",
  awareness_level: "Awareness level",
  pain_points: "Biggest pain points",
  false_beliefs: "False beliefs / objections",
  desired_transformation: "Desired transformation",
  category: "Market category",
  enemy: "The enemy / villain",
  differentiator: "Primary differentiator",
  competitive_alternatives: "Competitive alternatives",
  unique_mechanism: "Unique mechanism",
  core_promise: "Core promise",
  outcomes: "Top outcomes / benefits",
  proof: "Proof available",
  price: "Price point",
  guarantee: "Guarantee",
  bonuses: "Bonuses (if any)",
  scarcity_urgency: "Scarcity / urgency",
  cta: "Primary call to action",
  discovery_notes: "Additional discovery notes",
};

const AWARENESS_LEVELS = ["Unaware", "Problem-Aware", "Solution-Aware", "Product-Aware", "Most Aware"];

export function buildWebsiteImportPrompt(websiteText: string, sourceUrl: string): { system: string; user: string } {
  const fieldList = WEBSITE_IMPORT_FIELD_KEYS.map((k) => `"${k}"`).join(", ");

  const system = `You are a direct-response marketing strategist pre-filling a client discovery form from their own website's text content.

CRITICAL RULES:
1. Output ONLY a single valid JSON object, nothing before or after it — no markdown code fences, no commentary.
2. The object must have exactly these keys, every one present: ${fieldList}. Every value is a string.
3. If the website doesn't give you enough to confidently answer a field, use an empty string "" for it — do NOT invent specifics (an exact price, a named guarantee, a mechanism name) the site doesn't actually state. A blank field the member fills in themselves is far better than a wrong guess they don't notice and ship.
4. "awareness_level" must be exactly one of: ${AWARENESS_LEVELS.map((l) => `"${l}"`).join(", ")} — or "" if you can't reasonably judge it from the copy. Never any other text.
5. Keep each value tight and usable as-is in a form field: a sentence or a short bulleted list (using "- " line prefixes for lists), never a full paragraph of prose for list-type fields like pain_points or outcomes.
6. Write in the voice of someone describing their OWN business ("we help...", not "this company helps...").
7. "discovery_notes" is a catch-all — use it only for something genuinely useful you found that doesn't fit any other field (verbatim customer quotes, a notable stat), or leave it "".`;

  const user = `WEBSITE SOURCE: ${sourceUrl}

RAW TEXT EXTRACTED FROM THE WEBSITE (may include navigation/footer noise — use judgment about what's actually business content):
"""
${websiteText}
"""

Fill in as many of the ${WEBSITE_IMPORT_FIELD_KEYS.length} fields as this website genuinely supports. Return the JSON object now.`;

  return { system, user };
}

// Defensive parse — the model is instructed to return strict JSON, but never trust that blindly.
// Strips code fences if present, and coerces anything malformed to an empty-fields object rather
// than throwing, so a slightly-off response degrades to "nothing was pre-filled" instead of a
// hard error.
export function parseWebsiteImportResponse(raw: string): Record<WebsiteImportFieldKey, string> {
  const empty = Object.fromEntries(WEBSITE_IMPORT_FIELD_KEYS.map((k) => [k, ""])) as Record<
    WebsiteImportFieldKey,
    string
  >;

  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```[a-z]*\n?/i, "").replace(/\n?```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== "object") return empty;

  const result = { ...empty };
  for (const key of WEBSITE_IMPORT_FIELD_KEYS) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value === "string") {
      result[key] = key === "awareness_level" && !AWARENESS_LEVELS.includes(value.trim()) ? "" : value.trim();
    }
  }
  return result;
}
