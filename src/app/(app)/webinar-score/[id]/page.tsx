import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  webinarScoreAnalysisSchema,
  WEBINAR_READINESS_LABELS,
  WEBINAR_REBUILD_THRESHOLD,
  type WebinarReadiness,
  type WebinarScoreCategory,
} from "@/lib/webinarScore/schema";
import CreateProjectButton from "./CreateProjectButton";

export const metadata = { title: "Webinar Score" };

function scoreColor(score: number) {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-primary";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

const STATUS_STYLE = {
  present: { icon: CheckCircle2, label: "In place", className: "text-emerald-400" },
  partial: { icon: CircleDashed, label: "Partly there", className: "text-amber-400" },
  missing: { icon: XCircle, label: "Missing", className: "text-red-400" },
} as const;

const ERRORS: Record<string, string> = {
  project_limit:
    "You've reached the number of projects your plan allows. Delete a project you no longer need, or upgrade, then try again.",
  create_failed: "We couldn't create the project — please try again.",
};

export default async function WebinarScoreResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase.from("webinar_scores").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!row) notFound();
  if (row.status !== "complete") redirect("/webinar-score");

  const parsed = webinarScoreAnalysisSchema.safeParse(row.analysis);
  if (!parsed.success) redirect("/webinar-score");
  const analysis = parsed.data;
  const categories = ((row.analysis as { categories?: WebinarScoreCategory[] }).categories ?? []) as WebinarScoreCategory[];
  const score = row.score ?? 0;
  const readiness = WEBINAR_READINESS_LABELS[(row.readiness ?? "rebuild_recommended") as WebinarReadiness];
  const rebuild = score < WEBINAR_REBUILD_THRESHOLD;
  const missingCount = categories.filter((c) => c.status === "missing").length;
  const partialCount = categories.filter((c) => c.status === "partial").length;

  const x = analysis.extracted;
  const extractedCount =
    [
      x.business_name, x.industry, x.product, x.offer_name, x.audience, x.pain_points, x.false_beliefs,
      x.desired_transformation, x.enemy, x.differentiator, x.unique_mechanism, x.core_promise, x.outcomes,
      x.proof, x.price, x.guarantee, x.scarcity_urgency, x.cta,
    ].filter((v) => v.trim()).length +
    (x.stack_items.length ? 1 : 0) +
    (x.fast_action_bonuses.length ? 1 : 0);
  const presenterCount = Object.values(x.presenter).filter((v) => v.trim()).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/webinar-score" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Score My Webinar
      </Link>
      <h1 className="mt-3 font-display text-2xl font-semibold text-gradient-silver">{row.title || "My webinar"}</h1>

      {error && ERRORS[error] && (
        <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ERRORS[error]}
        </p>
      )}

      {/* Score */}
      <div className="mt-5 flex flex-wrap items-center gap-6 rounded-2xl border border-border bg-card/40 p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Framework score</p>
          <p className="flex items-baseline gap-2">
            <span className={`text-5xl font-bold ${scoreColor(score)}`}>{score}</span>
            <span className="text-muted-foreground">/ 100</span>
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{readiness.label}</p>
          <p className="text-sm text-muted-foreground">{readiness.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {missingCount} framework {missingCount === 1 ? "piece is" : "pieces are"} missing and {partialCount}{" "}
            {partialCount === 1 ? "is" : "are"} only partly there. This measures how closely it follows the framework —
            not a prediction of sales.
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm">{analysis.summary}</p>

      {/* Next step */}
      <div
        className={`mt-5 rounded-2xl border-2 p-5 ${rebuild ? "border-red-500/50 bg-red-500/10" : "border-primary/40 bg-primary/5"}`}
      >
        <p className={`font-semibold ${rebuild ? "text-red-400" : "text-primary"}`}>
          {rebuild ? "This webinar needs to be rebuilt" : "Let's make it even stronger"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {rebuild
            ? `Below ${WEBINAR_REBUILD_THRESHOLD}, too much of the framework is missing to patch. Pitch Perfect AI will walk you through Discovery, your Bio, and the Strategy Review, then build a new webinar that has every piece.`
            : "Pitch Perfect AI can rebuild it with every framework piece in place — starting from what your webinar already says."}{" "}
          We pulled {extractedCount} Discovery {extractedCount === 1 ? "answer" : "answers"}
          {presenterCount ? ` and ${presenterCount} Bio ${presenterCount === 1 ? "detail" : "details"}` : ""} from your
          webinar, so you won&apos;t start from scratch — you&apos;ll just confirm them and fill in the rest.
        </p>
        <div className="mt-3">
          {row.project_id ? (
            <Link
              href={`/projects/${row.project_id}`}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open your rebuild project
            </Link>
          ) : (
            <CreateProjectButton scoreId={row.id} rebuild={rebuild} />
          )}
        </div>
      </div>

      {analysis.critical_issues.length > 0 && (
        <section className="mt-6 rounded-xl border-2 border-red-500/50 bg-red-500/10 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Claims that could get you in trouble
          </h2>
          <ul className="mt-2 space-y-2 text-sm">
            {analysis.critical_issues.map((c, i) => (
              <li key={i}>
                <span className="font-medium">{c.issue}</span>
                {c.evidence && <span className="text-muted-foreground"> ({c.evidence})</span>}
                <div className="text-red-100/80">{c.why_it_matters}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {analysis.top_fixes.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Top fixes, most important first</h2>
          <ol className="mt-2 space-y-3">
            {analysis.top_fixes.map((f, i) => (
              <li key={i} className="rounded-lg border border-border bg-card/40 p-3 text-sm">
                <p className="font-medium">
                  {i + 1}. {f.title}
                </p>
                <p className="mt-1 text-muted-foreground">{f.why}</p>
                <p className="mt-1">
                  <span className="font-medium">How: </span>
                  {f.how}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Framework scorecard</h2>
        <div className="mt-2 space-y-2">
          {categories.map((c) => {
            const style = STATUS_STYLE[c.status];
            const Icon = style.icon;
            return (
              <details key={c.key} className="rounded-lg border border-border bg-card/40 p-3" open={c.status !== "present"}>
                <summary className="flex cursor-pointer items-center gap-3 text-sm">
                  <Icon className={`h-4 w-4 shrink-0 ${style.className}`} />
                  <span className="min-w-0 flex-1 font-medium">{c.label}</span>
                  <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
                    <span className="block h-full bg-primary" style={{ width: `${c.max ? (c.points / c.max) * 100 : 0}%` }} />
                  </span>
                  <span className="w-12 text-right tabular-nums text-muted-foreground">
                    {c.points}/{c.max}
                  </span>
                </summary>
                <div className="mt-2 space-y-1 pl-7 text-sm">
                  <p className={`text-xs font-medium ${style.className}`}>{style.label}</p>
                  {c.evidence && (
                    <p>
                      <span className="text-muted-foreground">Found: </span>
                      {c.evidence}
                    </p>
                  )}
                  {c.missing && (
                    <p>
                      <span className="text-muted-foreground">Missing: </span>
                      {c.missing}
                    </p>
                  )}
                  {c.how_to_fix && (
                    <p>
                      <span className="text-muted-foreground">How to fix: </span>
                      {c.how_to_fix}
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      {analysis.strengths.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">What it already does well</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {analysis.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
