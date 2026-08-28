"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Check, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IHELP_BUILDER_CREDIT_COST, type RatedIHelpStatement } from "@/lib/ai/ihelpBuilder";

function scoreColor(score: number) {
  if (score >= 8) return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
  if (score >= 6) return "text-primary border-primary/40 bg-primary/10";
  if (score >= 4) return "text-amber-400 border-amber-500/40 bg-amber-500/10";
  return "text-muted-foreground border-border bg-muted/30";
}

// Reads the four guided fields live from the parent form rather than owning its own copy — those
// fields are already visible and editable right above the "Generate" button on /bio, so
// duplicating them inside this dialog would just be a second place to edit the same thing. This
// only ever shows a read-only recap of what's about to be sent, plus the generated results.
export default function IHelpBuilderDialog({
  open,
  onOpenChange,
  audience,
  outcome,
  mechanism,
  painPoint,
  onAccept,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audience: string;
  outcome: string;
  mechanism: string;
  painPoint: string;
  onAccept: (statement: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [statements, setStatements] = useState<RatedIHelpStatement[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const ready = audience.trim().length >= 3 && outcome.trim().length >= 3 && mechanism.trim().length >= 3;

  function reset() {
    setLoading(false);
    setStatements([]);
    setSelected(null);
  }

  async function run() {
    if (!ready) return;
    setLoading(true);
    setSelected(null);
    try {
      const res = await fetch("/api/ihelp-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, outcome, mechanism, painPoint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const sorted = [...(data.statements as RatedIHelpStatement[])].sort((a, b) => b.score - a.score);
      setStatements(sorted);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  function accept() {
    if (!selected) return;
    onAccept(selected);
    onOpenChange(false);
    reset();
    toast.success("Statement inserted");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate stronger I Help Statements
          </DialogTitle>
          <DialogDescription>
            Uses your answers above (who you help, the result, your method, and their struggle) to
            draft several sharper, more specific alternatives — pick one, or use it as a starting
            point and edit further after inserting it.
          </DialogDescription>
        </DialogHeader>

        {!ready && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
            Fill in who you help, the result, and your method above first — the AI needs those to
            draft anything worth using.
          </p>
        )}

        {ready && statements.length === 0 && (
          <p className="text-xs text-muted-foreground">Costs {IHELP_BUILDER_CREDIT_COST} credits.</p>
        )}

        {statements.length > 0 && (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {statements.map((s) => (
              <button
                key={s.statement}
                type="button"
                onClick={() => setSelected(s.statement)}
                className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                  selected === s.statement ? "border-primary bg-primary/10" : "border-border bg-card/40 hover:bg-card/70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{s.statement}</span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${scoreColor(s.score)}`}
                  >
                    {s.score}
                  </span>
                </div>
                {s.reasoning && <p className="mt-1 text-xs text-muted-foreground">{s.reasoning}</p>}
              </button>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          {statements.length === 0 ? (
            <Button onClick={run} disabled={loading || !ready}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate options
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={run} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Try again
              </Button>
              <Button onClick={accept} disabled={!selected}>
                <Check className="mr-2 h-4 w-4" />
                Use this statement
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
