// The strategy object the review engine analyzes: every Discovery answer, normalized into one
// structured shape, grouped the way the review explains them. Pure and dependency-free so both
// server routes and the Strategy Review screen can use it. Nothing here ever writes to the
// project — revisions live on strategy rows and are overlaid at generation time (see
// applyApprovedFields), so the member's original Discovery answers are never overwritten.

import type { FastActionBonus, Project, StackItem } from "@/types/database";

export type StrategyTextFieldKey =
  | "business_name"
  | "industry"
  | "product"
  | "offer_name"
  | "audience"
  | "awareness_level"
  | "pain_points"
  | "competitive_alternatives"
  | "false_beliefs"
  | "desired_transformation"
  | "existing_assets"
  | "category"
  | "enemy"
  | "differentiator"
  | "unique_mechanism"
  | "core_promise"
  | "outcomes"
  | "proof"
  | "price"
  | "core_offer_value"
  | "guarantee"
  | "bonuses"
  | "scarcity_urgency"
  | "cta"
  | "funnel_type"
  | "cta_url"
  | "discovery_notes";

export const STRATEGY_FIELD_GROUPS: { group: string; fields: { key: StrategyTextFieldKey; label: string }[] }[] = [
  {
    group: "Business identity",
    fields: [
      { key: "business_name", label: "Business or brand name" },
      { key: "industry", label: "Industry and niche" },
      { key: "product", label: "Product or service description" },
      { key: "offer_name", label: "Core offer name" },
    ],
  },
  {
    group: "Audience and awareness",
    fields: [
      { key: "audience", label: "Target audience" },
      { key: "awareness_level", label: "Customer awareness level" },
      { key: "pain_points", label: "Biggest pain points" },
      { key: "competitive_alternatives", label: "Existing solutions attempted / competitive alternatives" },
      { key: "false_beliefs", label: "False beliefs and customer objections" },
      { key: "desired_transformation", label: "Desired transformation" },
      { key: "existing_assets", label: "Existing marketing assets" },
    ],
  },
  {
    group: "Positioning",
    fields: [
      { key: "category", label: "Marketing category" },
      { key: "enemy", label: "Market enemy or villain" },
      { key: "differentiator", label: "Primary differentiator" },
      { key: "unique_mechanism", label: "Unique mechanism / value proposition" },
      { key: "core_promise", label: "Core promise" },
      { key: "outcomes", label: "Top outcomes and benefits" },
    ],
  },
  {
    group: "Credibility",
    fields: [{ key: "proof", label: "Proof (testimonials, case studies, demonstrations, results)" }],
  },
  {
    group: "Offer engineering",
    fields: [
      { key: "price", label: "Actual selling price" },
      { key: "core_offer_value", label: "Core offer value" },
      { key: "guarantee", label: "Guarantee or risk reversal" },
      { key: "bonuses", label: "Bonuses (notes)" },
      { key: "scarcity_urgency", label: "Scarcity and urgency" },
    ],
  },
  {
    group: "Conversion",
    fields: [
      { key: "cta", label: "Primary call to action" },
      { key: "funnel_type", label: "Funnel type" },
      { key: "cta_url", label: "Checkout or booking link" },
      { key: "discovery_notes", label: "Additional business context" },
    ],
  },
];

export const STRATEGY_TEXT_FIELD_KEYS: StrategyTextFieldKey[] = STRATEGY_FIELD_GROUPS.flatMap((g) =>
  g.fields.map((f) => f.key)
);

export type StrategyFields = Record<StrategyTextFieldKey, string> & {
  stack_items: StackItem[];
  fast_action_bonuses: FastActionBonus[];
};

export function extractStrategyFields(project: Project): StrategyFields {
  const out = {} as StrategyFields;
  for (const key of STRATEGY_TEXT_FIELD_KEYS) out[key] = String(project[key] ?? "");
  out.stack_items = (project.stack_items ?? []).map((i) => ({ ...i }));
  out.fast_action_bonuses = (project.fast_action_bonuses ?? []).map((i) => ({ ...i }));
  return out;
}

// Stable key order so the same answers always hash the same (see hashStrategyFields on the server).
export function serializeStrategyFields(fields: StrategyFields): string {
  const ordered: Record<string, unknown> = {};
  for (const key of STRATEGY_TEXT_FIELD_KEYS) ordered[key] = fields[key];
  ordered.stack_items = fields.stack_items.map((i) => ({
    name: i.name,
    value: i.value,
    category: i.category ?? "stack",
    image_path: i.image_path ?? null,
  }));
  ordered.fast_action_bonuses = fields.fast_action_bonuses.map((i) => ({
    name: i.name,
    value: i.value,
    condition: i.condition,
    image_path: i.image_path ?? null,
  }));
  return JSON.stringify(ordered);
}

// A recommendation can target a plain text field ("audience") or one part of one stack item /
// fast action bonus ("stack_items[2].value"). "general" covers issues that span several fields;
// those are advisory and have nothing to apply.
const ITEM_FIELD = /^(stack_items|fast_action_bonuses)\[(\d+)\]\.(name|value|condition)$/;

export function isKnownFieldId(fieldId: string, fields: StrategyFields): boolean {
  if (fieldId === "general") return true;
  if ((STRATEGY_TEXT_FIELD_KEYS as string[]).includes(fieldId)) return true;
  const m = fieldId.match(ITEM_FIELD);
  if (!m) return false;
  const list = fields[m[1] as "stack_items" | "fast_action_bonuses"];
  const index = Number(m[2]);
  if (index >= list.length) return false;
  return m[1] === "fast_action_bonuses" || m[3] !== "condition";
}

export function getFieldValue(fields: StrategyFields, fieldId: string): string {
  if ((STRATEGY_TEXT_FIELD_KEYS as string[]).includes(fieldId)) return fields[fieldId as StrategyTextFieldKey];
  const m = fieldId.match(ITEM_FIELD);
  if (!m) return "";
  const item = fields[m[1] as "stack_items" | "fast_action_bonuses"][Number(m[2])] as
    | (StackItem & { condition?: string })
    | undefined;
  if (!item) return "";
  return String((item as Record<string, unknown>)[m[3]] ?? "");
}

export function setFieldValue(fields: StrategyFields, fieldId: string, value: string): StrategyFields {
  const next: StrategyFields = {
    ...fields,
    stack_items: fields.stack_items.map((i) => ({ ...i })),
    fast_action_bonuses: fields.fast_action_bonuses.map((i) => ({ ...i })),
  };
  if ((STRATEGY_TEXT_FIELD_KEYS as string[]).includes(fieldId)) {
    next[fieldId as StrategyTextFieldKey] = value;
    return next;
  }
  const m = fieldId.match(ITEM_FIELD);
  if (!m) return next;
  const list = next[m[1] as "stack_items" | "fast_action_bonuses"] as Record<string, unknown>[];
  const item = list[Number(m[2])];
  if (item) item[m[3]] = value;
  return next;
}

export function getFieldLabel(fields: StrategyFields, fieldId: string): string {
  if (fieldId === "general") return "Overall strategy";
  for (const g of STRATEGY_FIELD_GROUPS) {
    const f = g.fields.find((x) => x.key === fieldId);
    if (f) return f.label;
  }
  const m = fieldId.match(ITEM_FIELD);
  if (m) {
    const list = fields[m[1] as "stack_items" | "fast_action_bonuses"];
    const item = list[Number(m[2])];
    const kind =
      m[1] === "fast_action_bonuses"
        ? "Fast action bonus"
        : (item as StackItem | undefined)?.category === "bonus"
          ? "Bonus"
          : "Stack item";
    const part = m[3] === "value" ? "value" : m[3] === "condition" ? "qualifying condition" : "name";
    return `${kind} "${item?.name || `#${Number(m[2]) + 1}`}" — ${part}`;
  }
  return fieldId;
}

// The strategy fields minus anything the member has accepted a revision for: given the fields a
// review analyzed and its decided recommendations, returns the fields with every accepted (or
// edited-then-accepted) answer applied. Rejected, pending, needs-info, excluded, and attested
// recommendations change nothing — the original answer stands.
export function applyAcceptedRevisions(
  fields: StrategyFields,
  recs: { field_id: string; approval_status: string; final_answer: string | null; suggested_answer: string }[]
): StrategyFields {
  let next = fields;
  for (const rec of recs) {
    if (rec.approval_status !== "accepted" || rec.field_id === "general") continue;
    if (!isKnownFieldId(rec.field_id, next)) continue;
    next = setFieldValue(next, rec.field_id, rec.final_answer ?? rec.suggested_answer);
  }
  return next;
}

// Overlays an approved blueprint's frozen fields onto the live project for generation, so a
// presentation is built from the approved strategy rather than whatever Discovery says today.
// Only the strategy fields are replaced; every other project column (name, mode, naming, bio
// link) passes through untouched.
export function applyApprovedFields(project: Project, approved: Record<string, unknown>): Project {
  const next = { ...project } as Project & Record<string, unknown>;
  const writable = next as Record<string, unknown>;
  for (const key of STRATEGY_TEXT_FIELD_KEYS) {
    if (typeof approved[key] === "string") writable[key] = approved[key];
  }
  if (Array.isArray(approved.stack_items)) next.stack_items = approved.stack_items as StackItem[];
  if (Array.isArray(approved.fast_action_bonuses)) next.fast_action_bonuses = approved.fast_action_bonuses as FastActionBonus[];
  return next;
}

export function strategyFieldsFromJson(raw: unknown): StrategyFields {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out = {} as StrategyFields;
  for (const key of STRATEGY_TEXT_FIELD_KEYS) out[key] = typeof src[key] === "string" ? (src[key] as string) : "";
  out.stack_items = Array.isArray(src.stack_items) ? (src.stack_items as StackItem[]) : [];
  out.fast_action_bonuses = Array.isArray(src.fast_action_bonuses) ? (src.fast_action_bonuses as FastActionBonus[]) : [];
  return out;
}
