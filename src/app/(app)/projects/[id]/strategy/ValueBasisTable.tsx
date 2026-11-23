import type { StrategyFields } from "@/lib/strategy/fields";
import { EVIDENCE_LABELS, type StrategyAnalysis } from "@/lib/strategy/schema";
import { checkBasisMath, isValueBasisType, needsValueBasis, VALUE_BASIS_TYPES } from "@/lib/valueBasis";

// The Offer Review's value report: every priced item exactly as the member entered it (assigned
// value, basis category, basis) with the software's own math check, next to the review's evidence
// status and verdict for that item. Values shown here are never changed.
export default function ValueBasisTable({
  fields,
  bonuses,
}: {
  fields: StrategyFields;
  bonuses: StrategyAnalysis["offer_review"]["bonuses"];
}) {
  const rows = [
    ...fields.stack_items.map((item) => ({ kind: item.category === "bonus" ? "Bonus" : "Stack item", item })),
    ...fields.fast_action_bonuses.map((item) => ({ kind: "Fast action bonus", item })),
  ].filter((r) => r.item.name?.trim() || r.item.value?.trim());
  if (!rows.length) return null;
  const review = (name: string) => bonuses.find((b) => b.name.trim().toLowerCase() === name.trim().toLowerCase());

  return (
    <section>
      <h2 className="font-semibold">Value basis check</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Every value as you entered it, why it&apos;s worth that, and how believable the review found it. Your values are
        never changed — any correction is only a suggestion in Improve My Strategy.
      </p>
      <div className="mt-2 space-y-2">
        {rows.map(({ kind, item }, i) => {
          const type = isValueBasisType(item.basis_type) ? VALUE_BASIS_TYPES[item.basis_type] : null;
          const math = checkBasisMath(item.value, item.basis);
          const r = review(item.name ?? "");
          return (
            <div key={i} className="rounded-lg border border-border bg-card/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{kind}</span>
                <span className="font-medium">{item.name || "(unnamed)"}</span>
                <span className="ml-auto font-semibold">{item.value || "—"}</span>
              </div>
              {needsValueBasis(item) ? (
                <p className="mt-1 text-xs text-amber-400">Basis needed — add one in Discovery, or let the review suggest one.</p>
              ) : item.basis?.trim() ? (
                <p className="mt-1 text-xs">
                  <span className="text-muted-foreground">{type ? `${type.label}: ` : "Basis: "}</span>
                  {item.basis}
                  {type?.kind === "estimate" && <span className="text-muted-foreground"> (estimate)</span>}
                </p>
              ) : null}
              {math && (
                <p className={`mt-1 text-xs ${math.verdict === "exceeds" ? "text-amber-400" : "text-emerald-400"}`}>
                  Math check: {math.summary}
                </p>
              )}
              {r && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.evidence_status ? `Evidence: ${EVIDENCE_LABELS[r.evidence_status] ?? r.evidence_status} · ` : ""}
                  Review: {r.verdict === "keep" ? "Keep" : r.verdict === "drop" ? "Drop" : "Revise"}
                  {r.double_counted ? " · overlaps another item" : ""} — {r.value_basis}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
