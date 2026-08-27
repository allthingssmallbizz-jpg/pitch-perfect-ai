"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Copy, Loader2, ArrowDownAZ, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RatedHeadline } from "@/lib/ai/headlineLab";
import { HEADLINE_LAB_CREDIT_COST } from "@/lib/ai/headlineLab";
import { cn } from "@/lib/utils";

function formatHeadlineForFile(h: RatedHeadline): string {
  const lines = [`Score ${h.score}/10 — ${h.headline}`];
  if (h.subheadline) lines.push(h.subheadline);
  if (h.reasoning) lines.push(`Reasoning: ${h.reasoning}`);
  return lines.join("\n");
}

// Every run already saves to the database the moment it completes (see the "Recent runs" list
// on this page) — what was actually missing was a way to get a working file out of it once you
// leave the page, since re-opening a past run here doesn't help if you wanted these pasted into
// a doc or spreadsheet elsewhere. Plain .txt, not a server round-trip — this is just the
// on-screen data written to a file, no reason to involve the API for it.
function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function scoreColor(score: number) {
  if (score >= 8) return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
  if (score >= 6) return "text-primary border-primary/40 bg-primary/10";
  if (score >= 4) return "text-amber-400 border-amber-500/40 bg-amber-500/10";
  return "text-muted-foreground border-border bg-card/40";
}

export default function HeadlineLabClient({
  initialHeadlines,
  initialWinners,
  initialGenerationId,
}: {
  initialHeadlines: RatedHeadline[];
  initialWinners: string[];
  initialGenerationId: string | null;
}) {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [promise, setPromise] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headlines, setHeadlines] = useState<RatedHeadline[]>(initialHeadlines);
  const [generationId, setGenerationId] = useState<string | null>(initialGenerationId);
  const [winners, setWinners] = useState<Set<string>>(new Set(initialWinners));
  const [sortByScore, setSortByScore] = useState(true);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setHeadlines([]);
    setWinners(new Set());
    setGenerationId(null);
    try {
      const res = await fetch("/api/headlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), audience: audience.trim(), promise: promise.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed.");
        return;
      }
      setHeadlines(data.headlines);
      setGenerationId(data.generationId);
      toast.success(`Generated ${data.headlines.length} headlines. Pick your winners.`);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleWinner(h: string) {
    setWinners((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      if (generationId) {
        fetch(`/api/generations/${generationId}/winners`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winners: Array.from(next) }),
        }).catch(() => {});
      }
      return next;
    });
  }

  function copyOne(h: RatedHeadline) {
    navigator.clipboard.writeText(h.subheadline ? `${h.headline}\n${h.subheadline}` : h.headline);
    toast.success("Copied");
  }

  function copyWinners() {
    if (winners.size === 0) {
      toast.error("Pick some winners first");
      return;
    }
    const text = headlines
      .filter((h) => winners.has(h.headline))
      .map((h) => (h.subheadline ? `${h.headline}\n${h.subheadline}` : h.headline))
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${winners.size} winners`);
  }

  function downloadAll() {
    const text = displayed.map(formatHeadlineForFile).join("\n\n");
    downloadText(`headlines-${topic.trim() || "all"}.txt`.replace(/\s+/g, "-").toLowerCase(), text);
    toast.success(`Downloaded ${displayed.length} headlines`);
  }

  function downloadWinners() {
    if (winners.size === 0) {
      toast.error("Pick some winners first");
      return;
    }
    const text = headlines
      .filter((h) => winners.has(h.headline))
      .map(formatHeadlineForFile)
      .join("\n\n");
    downloadText(`headlines-winners-${topic.trim() || "selected"}.txt`.replace(/\s+/g, "-").toLowerCase(), text);
    toast.success(`Downloaded ${winners.size} winners`);
  }

  const displayed = sortByScore ? [...headlines].sort((a, b) => b.score - a.score) : headlines;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-gradient-silver">Headline lab</h1>
          <p className="mt-1 text-muted-foreground">
            Generate 20 rated headlines, each with a matching subheadline — {HEADLINE_LAB_CREDIT_COST} credits.
            The AI scores each pair 1-10 with reasoning; you pick the winners.
          </p>
        </div>
      </div>

      <form onSubmit={handleGenerate} className="card-elevated space-y-4 rounded-2xl p-6">
        <div>
          <Label htmlFor="topic">Topic / product *</Label>
          <Input
            id="topic"
            required
            placeholder="e.g. 8-week group coaching program for burnt-out founders"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="audience">Target audience</Label>
            <Input
              id="audience"
              placeholder="e.g. first-time founders, 2-5 years in"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="promise">Core promise</Label>
            <Input
              id="promise"
              placeholder="e.g. get your first 10 clients without cold outreach"
              value={promise}
              onChange={(e) => setPromise(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading || !topic.trim()}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {loading ? "Generating…" : "Generate headlines"}
        </Button>
      </form>

      {headlines.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              {winners.size} winner{winners.size === 1 ? "" : "s"} selected
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSortByScore((s) => !s)}>
                <ArrowDownAZ className="mr-2 h-4 w-4" />
                {sortByScore ? "Sorted by score" : "Original order"}
              </Button>
              <Button variant="outline" size="sm" onClick={copyWinners}>
                <Copy className="mr-2 h-4 w-4" />
                Copy winners
              </Button>
              <Button variant="outline" size="sm" onClick={downloadAll}>
                <FileDown className="mr-2 h-4 w-4" />
                Download all
              </Button>
              <Button variant="outline" size="sm" onClick={downloadWinners}>
                <FileDown className="mr-2 h-4 w-4" />
                Download winners
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {displayed.map((h, i) => {
              const isWinner = winners.has(h.headline);
              return (
                <div
                  key={`${h.headline}-${i}`}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-4 transition-colors",
                    isWinner ? "border-primary/50 bg-primary/5" : "border-border bg-card/40"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleWinner(h.headline)}
                    className={cn(
                      "mt-0.5 flex h-6 w-9 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
                      scoreColor(h.score)
                    )}
                    title="Toggle winner"
                  >
                    {h.score}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{h.headline}</p>
                    <p className={cn("mt-0.5 text-sm", h.subheadline ? "text-foreground/80" : "italic text-muted-foreground/60")}>
                      {h.subheadline || "(no subheadline generated for this one)"}
                    </p>
                    {h.reasoning && <p className="mt-1 text-xs text-muted-foreground">{h.reasoning}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyOne(h)}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Copy"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
