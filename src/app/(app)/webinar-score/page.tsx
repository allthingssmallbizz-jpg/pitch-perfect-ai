import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AGENTS } from "@/lib/agents/config";
import AgentBadge from "@/components/AgentBadge";
import { WEBINAR_READINESS_LABELS, type WebinarReadiness } from "@/lib/webinarScore/schema";
import WebinarScoreForm from "./WebinarScoreForm";
import RefreshWhilePending from "./RefreshWhilePending";

export const metadata = { title: "Score My Webinar" };

function scoreColor(score: number) {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-primary";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

export default async function WebinarScorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: scores } = await supabase
    .from("webinar_scores")
    .select("id, title, status, score, readiness, error, created_at, project_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  // A score still "pending" after 6 minutes was cut off and will never finish — show it as failed
  // (the next score request marks it failed in the database too).
  // eslint-disable-next-line react-hooks/purity -- server component, rendered once per request
  const now = Date.now();
  const list = (scores ?? []).map((s) =>
    s.status === "pending" && now - new Date(s.created_at).getTime() > 6 * 60 * 1000 ? { ...s, status: "failed" as const } : s
  );
  const anyPending = list.some((s) => s.status === "pending");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <AgentBadge agent={AGENTS.presentation_analysis} size="lg" />
      <h1 className="mt-4 font-display text-2xl font-semibold text-gradient-silver">Score My Webinar</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Already have a webinar? Find out how it measures up against the Pitch Perfect framework. You&apos;ll get a score
        out of 100, every missing piece, and exactly how to fix it — then rebuild or improve it with Pitch Perfect AI in
        one click, starting from what your webinar already says.
      </p>

      <div className="mt-6">
        <WebinarScoreForm />
      </div>

      {list.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your scored webinars</h2>
          {anyPending && <RefreshWhilePending />}
          <ul className="space-y-2">
            {list.map((s) => (
              <li key={s.id}>
                {s.status === "complete" ? (
                  <Link
                    href={`/webinar-score/${s.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 px-4 py-3 text-sm transition-colors hover:border-primary/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.title || "My webinar"}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                        {s.readiness ? ` · ${WEBINAR_READINESS_LABELS[s.readiness as WebinarReadiness]?.label ?? ""}` : ""}
                        {s.project_id ? " · project created" : ""}
                      </span>
                    </span>
                    <span className={`shrink-0 text-xl font-bold ${scoreColor(s.score ?? 0)}`}>{s.score}/100</span>
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
                    <span className="min-w-0 truncate">{s.title || "My webinar"}</span>
                    <span className={`shrink-0 text-xs ${s.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
                      {s.status === "pending" ? "Annie is scoring…" : "Didn't finish — not charged. Try again above."}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
