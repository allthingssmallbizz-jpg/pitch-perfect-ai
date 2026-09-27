"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wand2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TEXT_EDIT_CREDIT_COST } from "@/lib/ai/generators/textEdit";

// Course Outline's (and any future markdown generator's) equivalent of PageEditPanel — a plain
// "tell it what to add, remove, or change" box that applies a targeted edit to the already-
// generated content instead of a full regenerate, via the same /api/generations/[id]/edit
// endpoint's markdown-editable branch (see that route's TEXT_EDITABLE_ASSET_TYPES). No image/
// video handling here — none of that applies to a plain text document.
export default function TextEditPanel({
  generationId,
  onApplied,
}: {
  generationId: string;
  onApplied: (newContent: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [applying, setApplying] = useState(false);
  // A toast alone was easy to miss/not register as "it actually worked, go look" — reported as
  // "I hit apply but don't see the update." This stays on screen (not timed out) until the next
  // apply, naming exactly what was requested, so there's no ambiguity about whether it landed.
  const [lastApplied, setLastApplied] = useState<string | null>(null);
  // A toast alone on FAILURE has the same "easy to miss, looks like nothing happened" problem the
  // success banner above was already built to fix — reported again as "I hit apply and nothing
  // happens," which is exactly what a real failure (e.g. the underlying AI provider account being
  // out of funds — see the Anthropic/OpenAI billing issues elsewhere in this app) looks like when
  // the only sign of it is a toast that's already gone by the time someone looks back at the
  // screen. This stays on screen the same way the green one does, so "it silently did nothing" is
  // never actually silent.
  const [lastError, setLastError] = useState<string | null>(null);

  async function handleApply() {
    if (!instruction.trim()) {
      toast.error("Describe what to add, remove, or change first.");
      return;
    }
    setApplying(true);
    setLastApplied(null);
    setLastError(null);
    try {
      const appliedInstruction = instruction;
      const res = await fetch(`/api/generations/${generationId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const data = await res.json().catch(() => null);
      // A non-JSON response (data === null) means the platform cut the request off before this
      // route could reply at all — it always returns JSON, success or failure — most commonly a
      // hosting-plan function time limit on a longer edit. Previously this fell straight to the
      // generic "Could not apply that update." fallback below, which reads identically whether
      // the AI genuinely refused the request or the platform simply never let it finish — reported
      // as "I hit update and nothing happens" with no way to tell which one it actually was. Same
      // diagnostic already applied to the main Generate button's run() — this box just hadn't
      // gotten it yet.
      if (!data) {
        throw new Error(
          `The server didn't respond (HTTP ${res.status}) — this usually means the update ran past your hosting plan's time limit for a single request. Try a shorter, more specific instruction, or this needs that time limit raised.`
        );
      }
      if (!res.ok) throw new Error(data.error || "Could not apply that update.");

      onApplied(data.content);
      setInstruction("");
      setLastApplied(appliedInstruction);
      toast.success("Updated!");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not apply that update.";
      setLastError(message);
      toast.error(message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="card-elevated rounded-xl p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <Wand2 className="h-4 w-4" />
        Add, remove, or change something
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Tell Cora exactly what to add, take out, or change in the course above — a whole module, a
        specific lesson, a rename — and only that changes. Everything else stays exactly as it is.
        Heads up: this only changes what&apos;s shown above — hitting <strong>Regenerate</strong>{" "}
        later starts over completely fresh from your Discovery brief and will lose it. For a change
        you want to stick permanently (and also show up in every module&apos;s slides/quiz/workbook),
        add it to this project&apos;s Discovery Notes instead.
      </p>
      <Textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder={`e.g. "Add a module on pricing between Module 3 and Module 4" or "Remove the community accountability section" or "Rename Module 2 to 'Find Your Signature Offer'"`}
        rows={3}
        disabled={applying}
      />
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" onClick={handleApply} disabled={applying}>
          {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          {applying ? "Working..." : `Apply update (${TEXT_EDIT_CREDIT_COST} credits)`}
        </Button>
      </div>
      {lastApplied && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Updated: &quot;{lastApplied}&quot; — scroll down to see the change reflected in the course below.
          </span>
        </div>
      )}
      {lastError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Didn&apos;t go through: {lastError}</span>
        </div>
      )}
    </div>
  );
}
