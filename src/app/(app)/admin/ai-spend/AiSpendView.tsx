import Link from "next/link";
import { featureLabel, formatUsd, isUnfinished, type summarizeAiUsage } from "@/lib/ai/usageSummary";
import type { AiUsageLog } from "@/types/database";

export const AI_SPEND_RANGES = [7, 14, 30, 90] as const;

const STATUS_LABELS: Record<AiUsageLog["status"], string> = {
  ok: "Finished",
  cut_off: "Hit length limit",
  stopped: "Stopped (time limit)",
  error: "Failed",
};

// The AI Spend page's display — data is loaded by page.tsx.
export default function AiSpendView({
  days,
  rows,
  summary,
  memberNames,
  loadError,
}: {
  days: number;
  rows: AiUsageLog[];
  summary: ReturnType<typeof summarizeAiUsage>;
  memberNames: Record<string, string>;
  loadError: string | null;
}) {
  const memberName = (id: string | null) => (id ? memberNames[id] ?? id.slice(0, 8) : "No member (system)");
  const maxDay = Math.max(...summary.days.map((d) => d.cost), 0);
  const failures = rows.filter((r) => isUnfinished(r.status)).slice(0, 10);
  const today = summary.days[summary.days.length - 1];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <p className="mb-2 text-sm">
        <Link href="/admin" className="text-muted-foreground underline">
          ← Admin
        </Link>
      </p>
      <h1 className="font-display text-2xl font-semibold text-gradient-silver">AI Spend</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Every call the app makes to the Anthropic API — including coach chats, retries, and attempts that failed or
        were stopped partway (the API still bills for what was written). Days are UTC, the same as your Anthropic
        console, so these totals should match your bill closely.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Date range">
        {AI_SPEND_RANGES.map((r) => (
          <Link
            key={r}
            href={`/admin/ai-spend?days=${r}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              r === days ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            Last {r} days
          </Link>
        ))}
      </div>

      {loadError && (
        <p className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Couldn&apos;t load the AI usage log ({loadError}). If the table doesn&apos;t exist yet, run migration
          0057_ai_usage_log.sql in the Supabase SQL editor — the log starts recording from then on.
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={`Total, last ${days} days`} value={formatUsd(summary.total)} note={`${summary.calls.toLocaleString()} AI calls`} />
        <Stat label="Today (UTC)" value={formatUsd(today?.cost ?? 0)} note={`${(today?.calls ?? 0).toLocaleString()} AI calls`} />
        <Stat
          label="Spent on unfinished attempts"
          value={formatUsd(summary.failed)}
          note={`${summary.failedCalls.toLocaleString()} failed or stopped calls`}
        />
        <Stat
          label="Average per day"
          value={formatUsd(summary.total / days)}
          note={`≈ ${formatUsd((summary.total / days) * 30)} per 30 days at this rate`}
        />
      </div>

      <section className="card-elevated mt-6 rounded-2xl p-5">
        <h2 className="font-display text-base font-semibold">Daily spend</h2>
        {maxDay === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No AI spending recorded in this range yet.</p>
        ) : (
          <>
            <div className="mt-10 flex h-48 items-end gap-0.5 border-b border-border/60" aria-hidden="true">
              {summary.days.map((d, i) => (
                <div key={d.day} className="group relative flex h-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80"
                    style={{ height: `${Math.max(d.cost > 0 ? 2 : 0, (d.cost / maxDay) * 100)}%` }}
                  />
                  <div className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap ${
                      i < summary.days.length / 3 ? "left-0" : i > (summary.days.length * 2) / 3 ? "right-0" : "left-1/2 -translate-x-1/2"
                    } rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow group-hover:block`}
                  >
                    <span className="font-medium">{d.day}</span> · {formatUsd(d.cost)} · {d.calls} calls
                    {d.failedCost > 0 ? ` · ${formatUsd(d.failedCost)} unfinished` : ""}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{summary.days[0]?.day}</span>
              <span>Highest day: {formatUsd(maxDay)}</span>
              <span>{today?.day}</span>
            </div>
          </>
        )}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Show as a table</summary>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Day (UTC)</th>
                <th className="py-1 pl-4 text-right font-medium">Calls</th>
                <th className="py-1 pl-4 text-right font-medium">Spend</th>
                <th className="py-1 pl-4 text-right font-medium">Of which unfinished</th>
              </tr>
            </thead>
            <tbody>
              {[...summary.days].reverse().map((d) => (
                <tr key={d.day} className="border-t border-border/40">
                  <td className="py-1">{d.day}</td>
                  <td className="py-1 pl-4 text-right tabular-nums">{d.calls}</td>
                  <td className="py-1 pl-4 text-right tabular-nums">{formatUsd(d.cost)}</td>
                  <td className="py-1 pl-4 text-right tabular-nums">{d.failedCost ? formatUsd(d.failedCost) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="card-elevated mt-6 rounded-2xl p-5">
        <h2 className="font-display text-base font-semibold">What it went on</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 font-medium">Feature</th>
                <th className="py-1.5 pl-4 text-right font-medium">Calls</th>
                <th className="py-1.5 pl-4 text-right font-medium">Spend</th>
                <th className="hidden py-1.5 pl-4 text-right font-medium sm:table-cell">Share</th>
                <th className="hidden py-1.5 pl-4 text-right font-medium sm:table-cell">Avg per call</th>
                <th className="hidden py-1.5 pl-4 text-right font-medium sm:table-cell">Unfinished</th>
              </tr>
            </thead>
            <tbody>
              {summary.features.map((f) => (
                <tr key={f.feature} className="border-t border-border/40">
                  <td className="py-1.5">{f.label}</td>
                  <td className="py-1.5 pl-4 text-right tabular-nums">{f.calls}</td>
                  <td className="py-1.5 pl-4 text-right font-medium tabular-nums">{formatUsd(f.cost)}</td>
                  <td className="hidden py-1.5 pl-4 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {summary.total ? `${Math.round((f.cost / summary.total) * 100)}%` : "—"}
                  </td>
                  <td className="hidden py-1.5 pl-4 text-right tabular-nums sm:table-cell">{formatUsd(f.cost / f.calls)}</td>
                  <td className="hidden py-1.5 pl-4 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {f.failedCalls ? `${f.failedCalls} · ${formatUsd(f.failedCost)}` : "—"}
                  </td>
                </tr>
              ))}
              {summary.features.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-muted-foreground">
                    Nothing recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          One generation can be several calls — a slide deck is a plan plus about five sections, and a Strategy Review
          is three parts written at once.
        </p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card-elevated rounded-2xl p-5">
          <h2 className="font-display text-base font-semibold">Top members by spend</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {summary.members.slice(0, 10).map((m) => (
              <li key={m.userId ?? "none"} className="flex justify-between gap-3">
                <span className="truncate">{memberName(m.userId)}</span>
                <span className="shrink-0 tabular-nums">
                  {formatUsd(m.cost)} <span className="text-muted-foreground">· {m.calls} calls</span>
                </span>
              </li>
            ))}
            {summary.members.length === 0 && <li className="text-muted-foreground">Nothing recorded yet.</li>}
          </ul>
        </section>

        <section className="card-elevated rounded-2xl p-5">
          <h2 className="font-display text-base font-semibold">Recent unfinished attempts</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {failures.map((r) => (
              <li key={r.id} className="border-t border-border/40 pt-2 first:border-0 first:pt-0">
                <p className="flex justify-between gap-3">
                  <span className="font-medium">{featureLabel(r.feature)}</span>
                  <span className="shrink-0 tabular-nums">
                    {formatUsd(Number(r.cost_usd))}
                    {r.output_estimated ? "*" : ""}
                  </span>
                </p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {new Date(r.created_at).toISOString().replace("T", " ").slice(0, 16)} UTC · {STATUS_LABELS[r.status]}
                  {r.error ? ` — ${r.error}` : ""}
                </p>
              </li>
            ))}
            {failures.length === 0 && <li className="text-muted-foreground">None in this range.</li>}
          </ul>
          {failures.some((r) => r.output_estimated) && (
            <p className="mt-2 text-xs text-muted-foreground">
              * Estimated — the call stopped before the API reported its final size.
            </p>
          )}
        </section>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Costs use the model&apos;s list prices, including prompt-cache reads and writes. Small differences from the
        Anthropic console are normal (rounding, and calls stopped partway are estimated). Image generation, voice
        narration, and transcription use other providers and aren&apos;t included here.
      </p>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card-elevated rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
