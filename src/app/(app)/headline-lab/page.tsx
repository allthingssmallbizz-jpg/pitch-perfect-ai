import Link from "next/link";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { parseRatedHeadlines, type RatedHeadline } from "@/lib/ai/headlineLab";
import HeadlineLabClient from "./HeadlineLabClient";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function HeadlineLabPage({
  searchParams,
}: {
  searchParams: Promise<{ generationId?: string }>;
}) {
  const { generationId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let initialHeadlines: RatedHeadline[] = [];
  let initialWinners: string[] = [];
  let initialGenerationId: string | null = null;
  let initialTopic = "";
  let initialAudience = "";
  let initialPromise = "";

  if (generationId) {
    const { data: generation } = await supabase
      .from("generations")
      .select("content, winners, input_content")
      .eq("id", generationId)
      .eq("user_id", user.id)
      .eq("asset_type", "headline_lab")
      .single();

    if (generation?.content) {
      try {
        initialHeadlines = parseRatedHeadlines(generation.content);
        initialWinners = generation.winners ?? [];
        initialGenerationId = generationId;
      } catch {
        initialHeadlines = [];
      }
      // Repopulate the form with whatever was originally submitted, so reopening a past run gives
      // you something to tweak and regenerate from instead of a blank form next to old results.
      try {
        const parsedInput = generation.input_content ? JSON.parse(generation.input_content) : null;
        initialTopic = typeof parsedInput?.topic === "string" ? parsedInput.topic : "";
        initialAudience = typeof parsedInput?.audience === "string" ? parsedInput.audience : "";
        initialPromise = typeof parsedInput?.promise === "string" ? parsedInput.promise : "";
      } catch {
        // Older or malformed input_content — leave the form blank rather than guess.
      }
    }
  }

  // Every run already saves to the generations table the moment it completes — the actual gap
  // was never persistence, it was that leaving this page had no way back to a past run. This
  // surfaces that history the same way the project page's own History list does.
  const { data: pastRuns } = await supabase
    .from("generations")
    .select("id, created_at, input_content, status")
    .eq("user_id", user.id)
    .eq("asset_type", "headline_lab")
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(20);

  const recentRuns = (pastRuns ?? []).map((run) => {
    let topic = "Headlines";
    try {
      const parsedInput = run.input_content ? JSON.parse(run.input_content) : null;
      if (parsedInput?.topic) topic = parsedInput.topic;
    } catch {
      // Older or malformed input_content — fall back to the generic label above.
    }
    return { id: run.id, createdAt: run.created_at, topic };
  });

  return (
    <>
      {/* Keyed on the generation id so clicking between "Recent runs" (or back to a blank form)
          forces a full remount — without this, React keeps the same component instance across
          a search-param-only navigation, and its useState(initial...) calls never re-run, so the
          page visibly does nothing even though the server actually re-fetched fresh data. */}
      <HeadlineLabClient
        key={initialGenerationId ?? "new"}
        initialHeadlines={initialHeadlines}
        initialWinners={initialWinners}
        initialGenerationId={initialGenerationId}
        initialTopic={initialTopic}
        initialAudience={initialAudience}
        initialPromise={initialPromise}
      />

      {recentRuns.length > 0 && (
        <div className="mx-auto max-w-5xl px-6 pb-12">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <History className="h-4 w-4" />
            Recent runs
          </h2>
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <Link
                key={run.id}
                href={`/headline-lab?generationId=${run.id}`}
                className={`flex items-center justify-between rounded-lg border bg-card/40 px-4 py-2 text-sm transition-colors hover:border-primary/40 ${
                  run.id === initialGenerationId ? "border-primary/50 bg-primary/5" : "border-border"
                }`}
              >
                <span className="min-w-0 truncate">{run.topic}</span>
                <span className="ml-3 shrink-0 text-xs text-muted-foreground">{formatRelativeTime(run.createdAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
