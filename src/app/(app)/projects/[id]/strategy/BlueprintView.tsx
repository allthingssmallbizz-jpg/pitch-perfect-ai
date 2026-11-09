import type { Blueprint } from "@/lib/strategy/blueprint";

function Row({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-border/60 py-3 first:border-t-0 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {n}. {label}
      </div>
      <div className="min-w-0 whitespace-pre-line text-sm">{children}</div>
    </div>
  );
}

const missing = <span className="text-muted-foreground italic">Not provided</span>;
const text = (v: string | null | undefined) => (v && v.trim() ? v : missing);

// The one-page Approved Presentation Strategy Blueprint — the 16 items the presentation is built
// from, plus what the member changed, removed, or vouched for along the way.
export default function BlueprintView({ blueprint: b }: { blueprint: Blueprint }) {
  return (
    <div>
      <Row n={1} label="Business name">{text(b.business_name)}</Row>
      <Row n={2} label="Target audience">{text(b.target_audience)}</Row>
      <Row n={3} label="Awareness stage">{text(b.awareness_stage)}</Row>
      <Row n={4} label="Primary problem or desire">{text(b.primary_problem)}</Row>
      <Row n={5} label="Desired transformation">{text(b.desired_transformation)}</Row>
      <Row n={6} label="Core promise">{text(b.core_promise)}</Row>
      <Row n={7} label="Unique mechanism / differentiator">{text(b.differentiator)}</Row>
      <Row n={8} label="Main false beliefs">{text(b.false_beliefs)}</Row>
      <Row n={9} label="Top objections and responses">
        {b.objections.length ? (
          <ul className="space-y-1.5">
            {b.objections.map((o, i) => (
              <li key={i}>
                <span className="font-medium">{o.objection}</span> — {o.response}
              </li>
            ))}
          </ul>
        ) : (
          missing
        )}
      </Row>
      <Row n={10} label="Core offer and actual price">
        {text(b.core_offer.summary)}
        {b.core_offer.price ? <div className="mt-1 font-medium">Price: {b.core_offer.price}</div> : null}
      </Row>
      <Row n={11} label="Proof available">{text(b.proof)}</Row>
      <Row n={12} label="Bonus stack and supported values">
        {b.bonus_stack.length ? (
          <ul className="space-y-1">
            {b.bonus_stack.map((x, i) => (
              <li key={i}>
                {x.name} — {x.supported_value ?? <span className="text-muted-foreground">no supported dollar value (presented as an added benefit)</span>}
              </li>
            ))}
            {b.total_supported_value && <li className="font-medium">Total supported value: {b.total_supported_value}</li>}
          </ul>
        ) : (
          missing
        )}
      </Row>
      <Row n={13} label="Genuine scarcity and urgency">
        {b.scarcity.filter((s) => s.status === "genuine").length ? (
          <ul className="space-y-1">
            {b.scarcity
              .filter((s) => s.status === "genuine")
              .map((s, i) => (
                <li key={i}>{s.claim}</li>
              ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">None verified — nothing will be presented as scarce or urgent.</span>
        )}
      </Row>
      <Row n={14} label="Primary CTA">{text(b.cta)}</Row>
      <Row n={15} label="Funnel type">{text(b.funnel_type)}</Row>
      <Row n={16} label="Recommended framework">
        <span className="font-medium">{b.framework.name}</span> — {b.framework.reason}
      </Row>

      {b.accepted_revisions.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-card/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revisions you accepted</p>
          <ul className="mt-2 space-y-2 text-sm">
            {b.accepted_revisions.map((r, i) => (
              <li key={i}>
                <span className="font-medium">{r.field}:</span> {r.revised}
                <div className="text-xs text-muted-foreground">Was: {r.original || "(blank)"}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(b.unresolved_critical?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-lg border-2 border-red-500/50 bg-red-500/10 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-400">
            Critical issues you chose not to fix — unproven claims
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-red-100/90">
            {b.unresolved_critical!.map((c, i) => (
              <li key={i}>
                <span className="font-medium">{c.field}:</span> {c.claim}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-200/80">
            Your presentation treats these as your own unproven statements. Fix them and re-approve before presenting
            live.
          </p>
        </div>
      )}
      {b.excluded_claims.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-card/40 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Claims removed from your content</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {b.excluded_claims.map((c, i) => (
              <li key={i}>{c.claim}</li>
            ))}
          </ul>
        </div>
      )}
      {b.attested_claims.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-card/40 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Claims you vouched for (stated as your own report, not as verified)
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {b.attested_claims.map((c, i) => (
              <li key={i}>
                {c.claim}
                {c.note && <span className="text-muted-foreground"> — your evidence: {c.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(b.warnings.length > 0 || b.assumptions.length > 0) && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <p className="text-xs font-semibold uppercase tracking-wide">Remaining warnings and assumptions</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {b.warnings.map((w, i) => (
              <li key={`w${i}`}>{w}</li>
            ))}
            {b.assumptions.map((a, i) => (
              <li key={`a${i}`}>Assumption: {a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
