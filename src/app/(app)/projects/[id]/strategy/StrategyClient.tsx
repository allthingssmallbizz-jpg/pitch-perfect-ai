"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { StrategyRecommendation } from "@/types/database";
import type { StrategyState } from "@/lib/strategy/server";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildBlueprint, checkApproval, type Blueprint } from "@/lib/strategy/blueprint";
import { strategyFieldsFromJson } from "@/lib/strategy/fields";
import {
  EVIDENCE_LABELS,
  READINESS_LABELS,
  STRATEGY_REVIEW_CREDIT_COST,
  type CategoryScore,
  type StrategyAnalysis,
} from "@/lib/strategy/schema";
import RecommendationCard from "./RecommendationCard";
import BlueprintView from "./BlueprintView";

type Props = {
  projectId: string;
  initialState: StrategyState;
  discoveryIncomplete: boolean;
  // Demo mode (example data): nothing blocks approval — open critical issues are shown as what
  // would block a Live presentation instead.
  isDemo?: boolean;
};

const POLL_MS = 5000;

function scoreColor(score: number) {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-primary";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

// Critical first, then the review's own order. Stable (doesn't reshuffle as decisions are made),
// so "Item 3 of 9" always means the same item and Previous/Next behave predictably.
function coachingOrder(recs: StrategyRecommendation[]) {
  return [...recs].sort((a, b) => {
    if (a.is_critical !== b.is_critical) return a.is_critical ? -1 : 1;
    return a.position - b.position;
  });
}

// The next undecided item after `fromIndex`, wrapping around; -1 when everything is decided.
function nextUndecidedIndex(ordered: StrategyRecommendation[], fromIndex: number) {
  for (let step = 1; step <= ordered.length; step++) {
    const i = (fromIndex + step) % ordered.length;
    if (ordered[i].approval_status === "pending") return i;
  }
  return -1;
}

export default function StrategyClient({ projectId, initialState, discoveryIncomplete, isDemo = false }: Props) {
  const [state, setState] = useState<StrategyState>(initialState);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState("review");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [approving, setApproving] = useState(false);

  const review = state.review;
  const pending = review?.status === "pending";
  const analysis = review?.status === "complete" ? (review.analysis as StrategyAnalysis | null) : null;
  const categories = (review?.status === "complete" ? (review.category_scores as CategoryScore[] | null) : null) ?? [];
  const recs = state.recommendations;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/strategy/${projectId}`, { cache: "no-store" });
    if (!res.ok) return null;
    const next = (await res.json()) as StrategyState;
    setState(next);
    return next;
  }, [projectId]);

  // A review runs for a minute or two. If the connection drops (phone locks, tab backgrounded)
  // the server keeps going, so while the latest review is pending we keep checking for its result.
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => {
      refresh().catch(() => {});
    }, POLL_MS);
    return () => clearInterval(t);
  }, [pending, refresh]);

  async function runReview() {
    if (review?.status === "complete") {
      const ok = window.confirm(
        `Run a fresh review? It uses ${STRATEGY_REVIEW_CREDIT_COST} credits. Revisions you already accepted are carried forward, and this review stays in your history.`
      );
      if (!ok) return;
    }
    setRunning(true);
    try {
      const res = await fetch(`/api/strategy/${projectId}`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.code === "review_in_progress") {
        toast.message("Your review is already running — results will appear here shortly.");
        await refresh();
        return;
      }
      if (!res.ok) throw new Error(data?.error || "The review couldn't be completed. Nothing was charged.");
      setState(data as StrategyState);
      setCurrentId(null);
      setAcknowledged(false);
      setTab("review");
      toast.success("Your strategy review is ready.");
    } catch (e) {
      // The request may have been cut off while the server kept working — check before erroring.
      const next = await refresh().catch(() => null);
      if (next?.review?.status === "pending") {
        toast.message("Still working on your review — results will appear here shortly.");
      } else if (next?.review?.status === "complete" && next.review.id !== review?.id) {
        toast.success("Your strategy review is ready.");
        setTab("review");
      } else {
        toast.error(e instanceof Error ? e.message : "The review couldn't be completed.");
      }
    } finally {
      setRunning(false);
    }
  }

  function onRecUpdated(updated: StrategyRecommendation) {
    setState((s) => ({ ...s, recommendations: s.recommendations.map((r) => (r.id === updated.id ? updated : r)) }));
    setAcknowledged(false);
  }

  const ordered = useMemo(() => coachingOrder(recs), [recs]);
  // Starts on the first undecided item; afterwards follows the member's own navigation.
  const coachIndex = (() => {
    const byId = currentId ? ordered.findIndex((r) => r.id === currentId) : -1;
    if (byId >= 0) return byId;
    const firstPending = ordered.findIndex((r) => r.approval_status === "pending");
    return firstPending >= 0 ? firstPending : 0;
  })();
  const goTo = (i: number) => {
    if (ordered[i]) setCurrentId(ordered[i].id);
  };

  // In Improve My Strategy, making a decision moves straight on to the next undecided item.
  function onCoachRecUpdated(updated: StrategyRecommendation) {
    const before = recs.find((r) => r.id === updated.id);
    onRecUpdated(updated);
    if (before?.approval_status === "pending" && updated.approval_status !== "pending") {
      const nextOrdered = ordered.map((r) => (r.id === updated.id ? updated : r));
      const idx = nextOrdered.findIndex((r) => r.id === updated.id);
      const next = nextUndecidedIndex(nextOrdered, idx);
      if (next >= 0) setCurrentId(nextOrdered[next].id);
    }
  }
  const decidedCount = recs.filter((r) => r.approval_status !== "pending").length;
  const criticalOpen = recs.filter(
    (r) => r.is_critical && !["accepted", "excluded", "attested"].includes(r.approval_status)
  ).length;

  // Exactly what approving will save — the same pure functions the approve route uses.
  const preview = useMemo(() => {
    if (!review || !analysis) return null;
    const check = checkApproval({
      score: review.overall_score ?? 0,
      recs,
      discoveryChangedSinceReview: state.discoveryChangedSinceReview,
      demo: isDemo,
    });
    try {
      const { blueprint } = buildBlueprint({
        analyzedFields: strategyFieldsFromJson(review.input_fields),
        analysis,
        recs,
        warnings: check.warnings,
      });
      return { check, blueprint };
    } catch {
      return { check, blueprint: null };
    }
  }, [review, analysis, recs, state.discoveryChangedSinceReview, isDemo]);

  async function approve() {
    if (!review) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/strategy/reviews/${review.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledgeWarnings: acknowledged }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not approve the strategy.");
      setState(data as StrategyState);
      toast.success("Strategy approved — your presentation will be built from it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve the strategy.");
    } finally {
      setApproving(false);
    }
  }

  const approvedBlueprint = state.blueprint ? (state.blueprint.blueprint as Blueprint) : null;
  const approvedFromThisReview = Boolean(state.blueprint && review && state.blueprint.review_id === review.id);
  const generateTarget = approvedBlueprint?.framework.name === "25-Part VSL" ? "vsl_script" : "webinar_outline";

  const steps = [
    { label: "Discovery", done: !discoveryIncomplete },
    { label: "Strategy Review", done: review?.status === "complete" },
    { label: "Approval", done: Boolean(state.blueprint) },
    { label: "Generate", done: state.blueprint?.generation_status === "generated" },
  ];

  return (
    <div className="mt-5 space-y-5">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${
                s.done ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
              }`}
            >
              {s.done && <CheckCircle2 className="h-3.5 w-3.5" />}
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
          </li>
        ))}
      </ol>

      {isDemo && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100/90">
          <span className="font-semibold text-red-400">Demo mode — nothing here blocks you.</span> This project uses
          example data, so the review will flag example proof, results, and bonuses. In Demo mode those flags are
          teaching points: they show exactly what would have to be real and provable before a live webinar. You can
          approve and generate right away, or skip the review entirely and go straight to the agents.
        </div>
      )}
      {discoveryIncomplete && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Some Discovery questions are still blank. You can still run a review — missing answers will be flagged
          as follow-up questions — but you&apos;ll get a stronger review by{" "}
          <Link href={`/projects/${projectId}#discovery-form`} className="underline">
            finishing Discovery
          </Link>{" "}
          first.
        </div>
      )}
      {state.discoveryChangedSinceReview && review?.status === "complete" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          You&apos;ve edited Discovery since this review ran. Reanalyze to include your newest answers.
        </div>
      )}
      {state.blueprint && state.discoveryChangedSinceApproval && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Discovery changed after you approved your strategy. New presentations still use your approved version
          (v{state.blueprint.blueprint_version}) until you reanalyze and approve again.
        </div>
      )}

      {/* No review yet, or one running / failed */}
      {(!review || review.status !== "complete") && (
        <div className="rounded-xl border border-border bg-card/40 p-6 text-center">
          {pending || running ? (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 font-medium">Reviewing your strategy…</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This usually takes 1–2 minutes. You can leave this page — the results will be waiting when you
                come back.
              </p>
            </>
          ) : (
            <>
              <Sparkles className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-3 font-medium">
                {review?.status === "failed" ? "The last review didn't finish." : "Ready to review your strategy"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {review?.status === "failed"
                  ? `${review.error ?? "Something went wrong."} Nothing was charged.`
                  : "We'll score your strategy out of 100, flag anything that could hurt trust or conversions, check your offer and bonus values, and suggest stronger answers you can accept, edit, or reject."}
              </p>
              <Button className="mt-4" onClick={runReview} disabled={running}>
                {review?.status === "failed" ? "Try again" : "Review my strategy"} ({STRATEGY_REVIEW_CREDIT_COST}{" "}
                credits)
              </Button>
            </>
          )}
        </div>
      )}

      {review?.status === "complete" && analysis && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/40 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Strategy readiness · review v{review.review_version}
              </p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${scoreColor(review.overall_score ?? 0)}`}>
                  {review.overall_score ?? 0}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
                {review.readiness_status && (
                  <span className="text-sm font-medium">{READINESS_LABELS[review.readiness_status].label}</span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Measures how strong and clear your strategy is — not a prediction of sales.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {criticalOpen > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {criticalOpen} critical {criticalOpen === 1 ? "issue" : "issues"}{" "}
                  {isDemo ? "(would block Live mode)" : "to resolve"}
                </span>
              )}
              <Button size="sm" variant="outline" onClick={runReview} disabled={running}>
                {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                Reanalyze
              </Button>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex h-auto w-full flex-wrap justify-start">
              <TabsTrigger value="review">Review</TabsTrigger>
              <TabsTrigger value="improve">
                Improve My Strategy{recs.length ? ` (${decidedCount}/${recs.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="offer">Offer Review</TabsTrigger>
              <TabsTrigger value="approve">Approve</TabsTrigger>
            </TabsList>

            {/* ── Review ─────────────────────────────────────────── */}
            <TabsContent value="review" className="mt-4 space-y-5">
              <section className="rounded-xl border border-border bg-card/40 p-4">
                <p className="text-sm">{analysis.summary}</p>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Your offer in one sentence
                </p>
                <p className="mt-0.5 text-sm font-medium">{analysis.one_sentence_offer}</p>
              </section>

              {recs.some((r) => r.is_critical) && (
                <section>
                  <h2 className="text-sm font-semibold text-red-400">
                    {isDemo
                      ? "Critical issues (would block a Live presentation — optional in Demo mode)"
                      : "Critical issues (must be resolved before approval)"}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    These could create legal, ethical, or trust problems. They&apos;re listed separately from your
                    score.
                  </p>
                  <div className="mt-2 space-y-3">
                    {recs
                      .filter((r) => r.is_critical)
                      .map((r) => (
                        <RecommendationCard key={r.id} rec={r} onUpdated={onRecUpdated} />
                      ))}
                  </div>
                </section>
              )}

              {recs.some((r) => !r.is_critical) && (
                <section>
                  <h2 className="text-sm font-semibold">Top priority improvements</h2>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                    {recs
                      .filter((r) => !r.is_critical)
                      .slice(0, 3)
                      .map((r) => (
                        <li key={r.id}>
                          <span className="font-medium">{r.field_label}:</span> {r.issue}
                        </li>
                      ))}
                  </ol>
                  <Button size="sm" className="mt-3" onClick={() => setTab("improve")}>
                    Improve My Strategy
                  </Button>
                </section>
              )}

              <section>
                <h2 className="text-sm font-semibold">Category scores</h2>
                <div className="mt-2 space-y-2">
                  {categories.map((c) => (
                    <details key={c.key} className="rounded-lg border border-border bg-card/40 p-3">
                      <summary className="flex cursor-pointer items-center gap-3 text-sm">
                        <span className="flex-1 font-medium">{c.label}</span>
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full bg-primary"
                            style={{ width: `${c.max ? (c.points / c.max) * 100 : 0}%` }}
                          />
                        </span>
                        <span className="w-12 text-right tabular-nums text-muted-foreground">
                          {c.points}/{c.max}
                        </span>
                      </summary>
                      <p className="mt-2 text-sm text-muted-foreground">{c.rationale}</p>
                      {c.criteria_met.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs text-emerald-400">
                          {c.criteria_met.map((x, i) => (
                            <li key={i}>✓ {x}</li>
                          ))}
                        </ul>
                      )}
                      {c.criteria_missed.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-amber-400">
                          {c.criteria_missed.map((x, i) => (
                            <li key={i}>✗ {x}</li>
                          ))}
                        </ul>
                      )}
                    </details>
                  ))}
                </div>
              </section>

              {analysis.objections.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold">Objections your presentation must answer</h2>
                  <ul className="mt-2 space-y-2 text-sm">
                    {analysis.objections.map((o, i) => (
                      <li key={i} className="rounded-lg border border-border bg-card/40 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{o.objection}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            {o.coverage === "covered" ? "Already covered" : o.coverage === "partial" ? "Partly covered" : "Not covered yet"}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">{o.response}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {analysis.claims.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold">Your claims and their evidence</h2>
                  <ul className="mt-2 space-y-1 text-sm">
                    {analysis.claims.map((c, i) => (
                      <li key={i} className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {EVIDENCE_LABELS[c.status] ?? c.status}
                        </span>
                        <span>{c.claim}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {analysis.scarcity_items.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold">Scarcity and urgency</h2>
                  <ul className="mt-2 space-y-1 text-sm">
                    {analysis.scarcity_items.map((s, i) => (
                      <li key={i}>
                        <span
                          className={`mr-2 rounded-full px-2 py-0.5 text-[11px] ${
                            s.status === "genuine"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : s.status === "misleading"
                                ? "bg-red-500/15 text-red-400"
                                : "bg-amber-500/15 text-amber-400"
                          }`}
                        >
                          {s.status}
                        </span>
                        {s.claim} <span className="text-muted-foreground">— {s.note}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-card/40 p-3 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Funnel</p>
                  <p className="mt-1">
                    Current: {analysis.funnel.current} · Recommended: <span className="font-medium">{analysis.funnel.recommended}</span>
                  </p>
                  <p className="mt-1 text-muted-foreground">{analysis.funnel.reason}</p>
                </div>
                <div className="rounded-lg border border-border bg-card/40 p-3 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Audience awareness</p>
                  <p className="mt-1">
                    Selected: {analysis.awareness.selected} · Recommended:{" "}
                    <span className="font-medium">{analysis.awareness.recommended}</span>
                  </p>
                  <p className="mt-1 text-muted-foreground">{analysis.awareness.reason}</p>
                </div>
              </section>

              {analysis.assumptions.length > 0 && (
                <section className="text-sm">
                  <h2 className="text-sm font-semibold">Assumptions this review made</h2>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                    {analysis.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </section>
              )}

              <p className="text-xs text-muted-foreground">
                Want to change an answer yourself?{" "}
                <Link href={`/projects/${projectId}#discovery-form`} className="underline">
                  Edit Discovery
                </Link>
                , then come back and reanalyze.
              </p>
            </TabsContent>

            {/* ── Improve My Strategy (one item at a time) ───────── */}
            <TabsContent value="improve" className="mt-4 space-y-3">
              <details className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm" open={decidedCount === 0}>
                <summary className="cursor-pointer font-medium">How this works</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>
                    Each item is one suggestion for one Discovery answer. Pick an option and you&apos;ll move to the
                    next item automatically. Your Discovery answers are never changed.
                  </li>
                  <li>
                    <span className="text-foreground">Accept</span> uses the suggested wording.{" "}
                    <span className="text-foreground">Fill in the blanks</span> appears when the suggestion has{" "}
                    <mark className="rounded bg-amber-400/25 px-0.5 text-amber-200">[highlighted]</mark> parts only
                    you know — replace them with your real details.{" "}
                    <span className="text-foreground">Keep my original</span> leaves your answer as is.
                  </li>
                  <li>
                    {isDemo ? (
                      <>
                        Demo mode: everything is optional, even{" "}
                        <span className="font-medium text-red-400">Critical</span> items — they show what would have to
                        be real before a live webinar. Use <span className="text-foreground">Skip for now</span> freely.
                      </>
                    ) : (
                      <>
                        Only <span className="font-medium text-red-400">Critical</span> items must be answered before
                        you approve: rewrite it, remove the claim, or confirm it&apos;s true and say briefly what proves
                        it. Everything else is optional — use <span className="text-foreground">Skip for now</span>.
                      </>
                    )}
                  </li>
                </ul>
              </details>
              {ordered.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recommendations — your strategy is in great shape.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Item {Math.min(coachIndex, ordered.length - 1) + 1} of {ordered.length} · {decidedCount} decided
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={coachIndex <= 0}
                        onClick={() => goTo(coachIndex - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={coachIndex >= ordered.length - 1}
                        onClick={() => goTo(coachIndex + 1)}
                      >
                        {ordered[coachIndex]?.approval_status === "pending" && (isDemo || !ordered[coachIndex]?.is_critical)
                          ? "Skip for now"
                          : "Next"}
                      </Button>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${(decidedCount / ordered.length) * 100}%` }} />
                  </div>
                  {(() => {
                    const current = ordered[Math.min(coachIndex, ordered.length - 1)];
                    return <RecommendationCard key={current.id} rec={current} onUpdated={onCoachRecUpdated} coaching />;
                  })()}
                  {(decidedCount === ordered.length || criticalOpen === 0 || isDemo) && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                      {decidedCount === ordered.length
                        ? "Every item has a decision."
                        : isDemo && criticalOpen > 0
                          ? "Demo mode — you can approve any time."
                          : "All critical items are handled — the rest are optional."}{" "}
                      <button className="font-medium underline" onClick={() => setTab("approve")}>
                        Review and approve your strategy
                      </button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* ── Offer Review ───────────────────────────────────── */}
            <TabsContent value="offer" className="mt-4 space-y-4 text-sm">
              <section className="rounded-xl border border-border bg-card/40 p-4">
                <p className="font-medium">{analysis.offer_review.core_offer_summary}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Actual price</p>
                    <p>{analysis.offer_review.actual_price || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">How it&apos;s delivered</p>
                    <p>{analysis.offer_review.fulfillment}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Supportable core value</p>
                    <p>{analysis.offer_review.defensible_value ?? "No defensible dollar value yet"}</p>
                  </div>
                </div>
                {analysis.offer_review.includes.length > 0 && (
                  <>
                    <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">What&apos;s included</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {analysis.offer_review.includes.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              {analysis.offer_review.bonuses.length > 0 && (
                <section>
                  <h2 className="font-semibold">Bonus stack check</h2>
                  <div className="mt-2 space-y-2">
                    {analysis.offer_review.bonuses.map((b, i) => (
                      <div key={i} className="rounded-lg border border-border bg-card/40 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{b.name}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              b.verdict === "keep"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : b.verdict === "drop"
                                  ? "bg-red-500/15 text-red-400"
                                  : "bg-amber-500/15 text-amber-400"
                            }`}
                          >
                            {b.verdict === "keep" ? "Keep" : b.verdict === "drop" ? "Drop" : "Revise"}
                          </span>
                          {b.double_counted && (
                            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-400">
                              Already part of the core offer
                            </span>
                          )}
                          <span className="ml-auto font-medium">{b.supported_value ?? "No supported value"}</span>
                        </div>
                        <p className="mt-1 text-muted-foreground">{b.customer_benefit}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Deliverable: {b.deliverable}
                          {b.eligibility ? ` · Eligibility: ${b.eligibility}` : ""}
                          {b.availability ? ` · Availability: ${b.availability}` : ""}
                        </p>
                        <p className="mt-1 text-xs">Value basis: {b.value_basis}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-xl border border-border bg-card/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total supported value</p>
                <p className="text-lg font-semibold">
                  {analysis.offer_review.total_supported_value ?? "None of the listed values are supported yet"}
                </p>
                <p className="mt-2">{analysis.offer_review.value_explanation}</p>
              </section>

              {analysis.offer_review.fast_action.length > 0 && (
                <section>
                  <h2 className="font-semibold">Fast action bonuses</h2>
                  <ul className="mt-2 space-y-2">
                    {analysis.offer_review.fast_action.map((f, i) => (
                      <li key={i} className="rounded-lg border border-border bg-card/40 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{f.name}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            Can be fulfilled: {f.fulfillable}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Deadline: {f.deadline ?? "not stated"} · Who qualifies: {f.eligibility ?? "not stated"} · After it
                          expires: {f.after_expiration ?? "not stated"}
                        </p>
                        <p className="mt-1">{f.what_buyer_gets}</p>
                        {f.note && <p className="mt-1 text-xs">{f.note}</p>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {analysis.offer_review.industry_specific_checks.length > 0 && (
                <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
                  <p className="font-medium">Before you promise these, double-check:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {analysis.offer_review.industry_specific_checks.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </section>
              )}
            </TabsContent>

            {/* ── Approve ────────────────────────────────────────── */}
            <TabsContent value="approve" className="mt-4 space-y-4">
              {approvedFromThisReview && approvedBlueprint && state.blueprint ? (
                <>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
                    <p className="flex items-center gap-2 font-medium text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Strategy approved (v{state.blueprint.blueprint_version},{" "}
                      {new Date(state.blueprint.approved_at).toLocaleDateString()})
                    </p>
                    <p className="mt-1">
                      Every presentation you generate now follows this approved strategy. Your original Discovery
                      answers are kept as they were.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link href={`/projects/${projectId}/generate/${generateTarget}`}>Generate My Presentation</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/projects/${projectId}/generate/ppt_outline`}>Build slides</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/projects/${projectId}/generate/challenge_outline`}>Challenge outline</Link>
                      </Button>
                    </div>
                  </div>
                  <section className="rounded-xl border border-border bg-card/40 p-4">
                    <h2 className="mb-2 text-sm font-semibold">Approved Presentation Strategy Blueprint</h2>
                    <BlueprintView blueprint={approvedBlueprint} />
                  </section>
                </>
              ) : preview ? (
                <>
                  {state.blueprint && (
                    <p className="rounded-lg border border-border bg-card/40 p-3 text-sm text-muted-foreground">
                      You have an earlier approved strategy (v{state.blueprint.blueprint_version}). Approving this review
                      saves a new version — the earlier one stays in your history.
                    </p>
                  )}
                  {preview.check.blockers.length > 0 && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
                      <p className="font-medium text-red-400">Resolve these before approving:</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {preview.check.blockers.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => setTab("review")}>
                        Go to critical issues
                      </Button>
                    </div>
                  )}
                  {preview.check.warnings.length > 0 && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                      <ul className="list-disc space-y-0.5 pl-5">
                        {preview.check.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                      <label className="mt-2 flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={acknowledged}
                          onChange={(e) => setAcknowledged(e.target.checked)}
                        />
                        <span>I understand and want to approve anyway.</span>
                      </label>
                    </div>
                  )}
                  {preview.blueprint && (
                    <section className="rounded-xl border border-border bg-card/40 p-4">
                      <h2 className="mb-2 text-sm font-semibold">Preview: your Presentation Strategy Blueprint</h2>
                      <BlueprintView blueprint={preview.blueprint} />
                    </section>
                  )}
                  <Button
                    onClick={approve}
                    disabled={
                      approving ||
                      preview.check.blockers.length > 0 ||
                      (preview.check.warnings.length > 0 && !acknowledged)
                    }
                  >
                    {approving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    Approve Strategy
                  </Button>
                </>
              ) : null}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* An earlier approval still drives generation while a new review is running or failed. */}
      {review?.status !== "complete" && approvedBlueprint && state.blueprint && (
        <section className="rounded-xl border border-border bg-card/40 p-4">
          <h2 className="mb-2 text-sm font-semibold">
            Your approved strategy (v{state.blueprint.blueprint_version}) — still in use
          </h2>
          <BlueprintView blueprint={approvedBlueprint} />
        </section>
      )}
    </div>
  );
}
