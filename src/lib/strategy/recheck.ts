// Re-checks: when a member reanalyzes, the new review confirms the previous list was worked
// through instead of hunting for brand-new problems in answers that already passed. Without this a
// member fixes one item, reanalyzes, gets a different "strongly recommended" item, and goes round
// in circles. Pure — the review route and tests share it.

import { getFieldValue, isKnownFieldId, STRATEGY_TEXT_FIELD_KEYS, type StrategyFields } from "./fields";
import type { StrategyRecheck } from "./prompt";
import type { StrategyRecommendation, StrategySeverity } from "@/types/database";

// Decisions where the member chose to leave the answer as it is — respected on a re-check unless
// the field itself changed.
const SETTLED = new Set(["rejected", "excluded", "attested"]);

export type RecheckSummary = {
  previous_version: number;
  // Counted per Discovery answer: several findings on one answer count once.
  previous_items: number;
  resolved: number;
  still_open: number;
  new_on_changed: number;
  optional_extras: number;
};

export type RecheckContext = StrategyRecheck & {
  changed: Set<string>;
  previousByField: Map<string, Pick<StrategyRecommendation, "approval_status" | "is_critical">[]>;
};

export function buildRecheckContext(
  previousVersion: number,
  previousInput: StrategyFields,
  previousRecs: Pick<StrategyRecommendation, "field_id" | "issue" | "is_critical" | "approval_status">[],
  fields: StrategyFields
): RecheckContext {
  const previousByField = new Map<string, Pick<StrategyRecommendation, "approval_status" | "is_critical">[]>();
  for (const r of previousRecs) {
    const list = previousByField.get(r.field_id) ?? [];
    list.push(r);
    previousByField.set(r.field_id, list);
  }
  // Every field id the member could have touched: the previous findings' fields plus every field
  // of today's input.
  const candidates = new Set<string>(previousRecs.map((r) => r.field_id));
  for (const key of STRATEGY_TEXT_FIELD_KEYS) candidates.add(key);
  const itemCount = (k: "stack_items" | "fast_action_bonuses") => Math.max(fields[k].length, previousInput[k].length);
  for (const k of ["stack_items", "fast_action_bonuses"] as const) {
    for (let i = 0; i < itemCount(k); i++) {
      for (const part of ["name", "value", "basis", "condition"]) candidates.add(`${k}[${i}].${part}`);
    }
  }
  const changed = new Set<string>();
  for (const id of candidates) {
    if (id === "general") continue;
    if (!isKnownFieldId(id, fields) && !isKnownFieldId(id, previousInput)) continue;
    if ((getFieldValue(fields, id) ?? "").trim() !== (getFieldValue(previousInput, id) ?? "").trim()) changed.add(id);
  }
  return {
    previousVersion,
    findings: previousRecs.map((r) => ({
      field_id: r.field_id,
      issue: r.issue.slice(0, 220),
      critical: r.is_critical,
      client_decision: r.approval_status,
    })),
    changedFieldIds: [...changed],
    changed,
    previousByField,
  };
}

type Rec = { field_id: string; is_critical: boolean; severity: StrategySeverity; issue: string };

// Keeps what the re-check should show at full strength — earlier findings that are still open and
// anything in an answer the member changed — and turns everything else into an optional extra.
export function applyRecheck<R extends Rec>(recs: R[], ctx: RecheckContext): { recs: R[]; summary: RecheckSummary } {
  let stillOpen = 0;
  let newOnChanged = 0;
  let optional = 0;
  const stillFields = new Set<string>();
  const out = recs.map((rec) => {
    const previous = ctx.previousByField.get(rec.field_id) ?? [];
    const fieldChanged = ctx.changed.has(rec.field_id);
    if (fieldChanged) {
      if (previous.length) {
        stillOpen++;
        stillFields.add(rec.field_id);
      } else newOnChanged++;
      return rec;
    }
    if (previous.length) {
      const settled = previous.every((p) => SETTLED.has(p.approval_status));
      // A critical claim the member kept without backing it up stays critical — the warning still
      // matters. Everything else they settled isn't raised at full strength again.
      const keptUnprovenCritical = rec.is_critical && previous.some((p) => p.approval_status === "rejected");
      if (!settled || keptUnprovenCritical) {
        stillOpen++;
        stillFields.add(rec.field_id);
        return rec;
      }
    }
    optional++;
    return {
      ...rec,
      is_critical: false,
      severity: "low" as StrategySeverity,
      issue: rec.issue.startsWith("Optional") ? rec.issue : `Optional — ${rec.issue}`,
    };
  });
  const previousFields = new Set(ctx.findings.map((f) => f.field_id));
  return {
    recs: out,
    summary: {
      previous_version: ctx.previousVersion,
      previous_items: previousFields.size,
      resolved: [...previousFields].filter((f) => !stillFields.has(f)).length,
      still_open: stillOpen,
      new_on_changed: newOnChanged,
      optional_extras: optional,
    },
  };
}
