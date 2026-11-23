// Value Basis: the reason behind every dollar value in an offer stack — "why is this item worth the
// amount assigned to it?" Kept separate from the value itself so the two are never confused:
//   - value (the Assigned Value): the dollar amount attributed to an item. Never changed by the
//     software without the member's approval.
//   - basis_type + basis (the Value Basis): the category of reasoning and the member's own
//     explanation, which the Strategy Review reads and judges.
// Pure and client-safe — the Discovery form, the generators, and the Strategy Review share it.

export const VALUE_BASIS_TYPES = {
  standalone_price: {
    label: "Actual Standalone Selling Price",
    short: "Standalone price",
    hint: "What you sell this for on its own today.",
    kind: "price",
  },
  historical_price: {
    label: "Historical Selling Price",
    short: "Past price",
    hint: "What you've charged for it before.",
    kind: "price",
  },
  comparable_market: {
    label: "Comparable Market Value",
    short: "Comparable value",
    hint: "What similar products or services sell for — an estimate unless you can point to real examples.",
    kind: "estimate",
  },
  hourly_rate: {
    label: "Professional Hourly Rate",
    short: "Hourly rate",
    hint: "Your rate (or a professional's) × the time involved.",
    kind: "calculation",
  },
  cost_to_deliver: {
    label: "Cost to Create or Deliver",
    short: "Cost to deliver",
    hint: "What it costs you to create or provide it.",
    kind: "calculation",
  },
  customer_savings: {
    label: "Measurable Customer Savings",
    short: "Customer savings",
    hint: "Money it measurably saves the customer.",
    kind: "estimate",
  },
  other: {
    label: "Other — Explain",
    short: "Other",
    hint: "Explain the reason in your own words.",
    kind: "other",
  },
} as const;
export type ValueBasisType = keyof typeof VALUE_BASIS_TYPES;

export function isValueBasisType(v: unknown): v is ValueBasisType {
  return typeof v === "string" && v in VALUE_BASIS_TYPES;
}

type Priced = { name?: string; value?: string; basis?: string; basis_type?: string };

// A value with no written explanation needs a basis. Non-blocking: the item stays fully usable.
export function needsValueBasis(item: Priced): boolean {
  return Boolean(item.value?.trim()) && !item.basis?.trim();
}

// The one plain-language question asked when a value has no basis yet.
export function valueBasisQuestion(item: Priced): string {
  const name = item.name?.trim() || "this item";
  const value = item.value?.trim() || "its";
  return `You've assigned your ${name} a ${value} value. Is that based on what you've charged before, what similar options cost, your time, or another reason?`;
}

const NUMBER = String.raw`\d[\d,]*(?:\.\d+)?`;
const UNIT_WORDS: Record<string, string> = {
  hour: "hour", hours: "hour", hr: "hour", hrs: "hour",
  month: "month", months: "month", mo: "month", mos: "month",
  week: "week", weeks: "week", wk: "week", wks: "week",
  year: "year", years: "year", yr: "year", yrs: "year",
  day: "day", days: "day",
  session: "session", sessions: "session", call: "call", calls: "call",
};
const UNIT = String.raw`(hours?|hrs?|months?|mos?|weeks?|wks?|years?|yrs?|days?|sessions?|calls?)`;

function toNumber(s: string): number {
  return Number(s.replace(/,/g, ""));
}

export function parseDollars(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const m = value.match(new RegExp(NUMBER));
  if (!m) return null;
  const n = toNumber(m[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: n % 1 ? 2 : 0 })}`;
}

export type BasisMath = {
  rate: number;
  quantity: number;
  unit: string | null;
  computed: number;
  assigned: number | null;
  verdict: "matches" | "conservative" | "exceeds" | "no_assigned_value";
  summary: string;
};

// Checks the arithmetic in a basis like "$497/month × 12 months", "$150 per hour for 3 hours", or
// "$250 × 4 sessions" against the assigned value — so a subscription or hourly calculation is
// verified by the software, not guessed by the AI. Returns null when the basis isn't a rate ×
// quantity calculation.
export function checkBasisMath(value: string | undefined, basis: string | undefined): BasisMath | null {
  if (!basis?.trim()) return null;
  const text = basis.replace(/\s+/g, " ");
  let rate: number | null = null;
  let rateUnit: string | null = null;
  let quantity: number | null = null;

  // "$497/month", "$150 per hour", "$150 an hour", "$150/hr"
  const perUnit = text.match(new RegExp(String.raw`\$\s?(${NUMBER})\s*(?:\/|per|an?|each)\s*${UNIT}\b`, "i"));
  if (perUnit) {
    rate = toNumber(perUnit[1]);
    rateUnit = UNIT_WORDS[perUnit[2].toLowerCase()] ?? null;
    const rest = text.slice((perUnit.index ?? 0) + perUnit[0].length);
    const times = rest.match(new RegExp(String.raw`(?:[x×*]|times|for|over)\s*(${NUMBER})\b`, "i"));
    const counted = rest.match(new RegExp(String.raw`(${NUMBER})\s*-?\s*${UNIT}\b`, "i"));
    if (counted && (!rateUnit || UNIT_WORDS[counted[2].toLowerCase()] === rateUnit)) quantity = toNumber(counted[1]);
    else if (times) quantity = toNumber(times[1]);
  } else {
    // "$250 × 4 sessions", "$150 x 3"
    const product = text.match(new RegExp(String.raw`\$\s?(${NUMBER})\s*(?:[x×*]|times)\s*(${NUMBER})\s*${UNIT}?`, "i"));
    if (product) {
      rate = toNumber(product[1]);
      quantity = toNumber(product[2]);
      rateUnit = product[3] ? UNIT_WORDS[product[3].toLowerCase()] ?? null : null;
    }
  }
  if (rate === null || quantity === null || !(rate > 0) || !(quantity > 0)) return null;

  const computed = Math.round(rate * quantity * 100) / 100;
  const assigned = parseDollars(value);
  const unitLabel = rateUnit ? `${rateUnit}${quantity === 1 ? "" : "s"}` : "";
  const calc = `${money(rate)}${rateUnit ? `/${rateUnit}` : ""} × ${quantity.toLocaleString("en-US")}${unitLabel ? ` ${unitLabel}` : ""} = ${money(computed)}`;
  let verdict: BasisMath["verdict"];
  let summary: string;
  if (assigned === null) {
    verdict = "no_assigned_value";
    summary = `${calc}.`;
  } else if (Math.abs(assigned - computed) <= computed * 0.05) {
    verdict = "matches";
    summary = `${calc} — matches the assigned ${money(assigned)}.`;
  } else if (assigned < computed) {
    verdict = "conservative";
    summary = `${calc} — the assigned ${money(assigned)} is a conservative value below that.`;
  } else {
    verdict = "exceeds";
    summary = `${calc} — but the assigned ${money(assigned)} is higher than this calculation supports.`;
  }
  return { rate, quantity, unit: rateUnit, computed, assigned, verdict, summary };
}

// One line describing an item's value and basis, for the generators' Discovery block and the
// Strategy Review's computed checks.
export function describeValueBasis(item: Priced): string {
  const type = isValueBasisType(item.basis_type) ? VALUE_BASIS_TYPES[item.basis_type] : null;
  if (!item.basis?.trim()) {
    return item.value?.trim()
      ? "no value basis given — present the value as the member's own number and never invent a reason for it"
      : "";
  }
  const math = checkBasisMath(item.value, item.basis);
  const estimate =
    type?.kind === "estimate" ? " — this is an estimate unless real supporting examples are given; never present it as a verified price" : "";
  return `value basis${type ? ` (${type.label})` : ""}: ${item.basis.trim()}${math ? ` [math check: ${math.summary}]` : ""}${estimate}`;
}

// Additional Notes (the free-text Bonuses box) sometimes already explain a value. Returns the note
// line for this item only when the match is reliable — the line names the item and talks about
// value or price — so the member can copy it into the item's basis. Never removes anything.
export function findBasisInNotes(item: Priced, notes: string | null | undefined): string | null {
  const name = item.name?.trim();
  if (!name || name.length < 4 || !notes?.trim()) return null;
  const needle = name.toLowerCase();
  const valueWords = /\$|\bvalue\b|\bworth\b|\bprice\b|\brate\b|\bcharge|\bcost|\bcomparable|\bretail/i;
  for (const raw of notes.split(/\n+/)) {
    const line = raw.replace(/^\s*[-*•]\s*/, "").trim();
    if (line.toLowerCase().includes(needle) && valueWords.test(line)) return line.slice(0, 500);
  }
  return null;
}
