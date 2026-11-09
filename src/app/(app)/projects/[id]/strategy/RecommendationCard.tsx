"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle, Send } from "lucide-react";
import type { StrategyRecommendation } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EVIDENCE_LABELS, STRATEGY_COACH_CREDIT_COST } from "@/lib/strategy/schema";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  medium: "bg-primary/10 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
};

export const DECISION_LABELS: Record<string, string> = {
  pending: "Not decided yet",
  accepted: "Accepted",
  rejected: "Kept your original",
  needs_info: "Needs more information",
  excluded: "Claim removed from content",
  attested: "You vouched for this",
};

const BRACKET_RE = /\[[^\]]+\]/g;

// The AI marks anything only the member can supply ("[your NMLS ID]", "[number of clients]") in
// [brackets]. Highlighted so it's obvious what still needs their real details.
function withBlanksHighlighted(text: string) {
  return text.split(/(\[[^\]]+\])/g).map((part, i) =>
    /^\[[^\]]+\]$/.test(part) ? (
      <mark key={i} className="rounded bg-amber-400/25 px-0.5 text-amber-200">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

type Props = {
  rec: StrategyRecommendation;
  onUpdated: (rec: StrategyRecommendation) => void;
  // Full coaching view (Improve My Strategy) vs. the compact list on the Review tab.
  coaching?: boolean;
};

export default function RecommendationCard({ rec, onUpdated, coaching = false }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rec.final_answer ?? rec.suggested_answer);
  const [attesting, setAttesting] = useState(false);
  const [note, setNote] = useState(rec.client_note ?? "");
  const [message, setMessage] = useState("");

  async function decide(body: Record<string, unknown>, label: string) {
    setBusy(label);
    try {
      const res = await fetch(`/api/strategy/recommendations/${rec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not save that.");
      onUpdated(data.recommendation);
      setEditing(false);
      setAttesting(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that.");
    } finally {
      setBusy(null);
    }
  }

  async function coach(mode: "why" | "alternative" | "message") {
    if (mode === "message" && !message.trim()) return;
    setBusy(`coach-${mode}`);
    try {
      const res = await fetch(`/api/strategy/recommendations/${rec.id}/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "The coach couldn't answer.");
      onUpdated(data.recommendation);
      setDraft(data.recommendation.suggested_answer);
      setMessage("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The coach couldn't answer.");
    } finally {
      setBusy(null);
    }
  }

  const decided = rec.approval_status !== "pending";
  const hasSuggestion = Boolean(rec.suggested_answer.trim());
  const suggestionBlanks = rec.suggested_answer.match(BRACKET_RE) ?? [];
  const draftBlanks = draft.match(BRACKET_RE) ?? [];

  return (
    <div className={`rounded-xl border bg-card/40 p-4 ${rec.is_critical ? "border-red-500/40" : "border-border"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_STYLES[rec.severity]}`}>
          {rec.is_critical ? "Critical" : rec.severity}
        </span>
        <span className="text-sm font-medium">{rec.field_label}</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${
            decided ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
          }`}
        >
          {DECISION_LABELS[rec.approval_status]}
        </span>
      </div>

      {rec.original_answer.trim() && (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Your original answer</p>
          <p className="mt-0.5 whitespace-pre-line text-sm">{rec.original_answer}</p>
        </div>
      )}
      <div className="mt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Issue</p>
        <p className="mt-0.5 text-sm">{rec.issue}</p>
      </div>
      <div className="mt-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Why it matters to your buyer</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{rec.explanation}</p>
      </div>
      {rec.follow_up_question && (
        <p className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium text-primary">Question for you: </span>
          {rec.follow_up_question}
        </p>
      )}
      {hasSuggestion && (
        <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Suggested revision {rec.requires_confirmation && <span className="normal-case text-amber-400">— needs your confirmation</span>}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm">{withBlanksHighlighted(rec.suggested_answer)}</p>
          {suggestionBlanks.length > 0 && (
            <p className="mt-2 text-xs text-amber-300">
              The highlighted [blanks] are details only you know. To use this suggestion, click &quot;Fill in the
              blanks&quot; and replace each one with your real information — or choose another option below.
            </p>
          )}
          {rec.evidence_status !== "not_applicable" && (
            <p className="mt-1 text-[11px] text-muted-foreground">Evidence status: {EVIDENCE_LABELS[rec.evidence_status]}</p>
          )}
        </div>
      )}
      {rec.approval_status === "accepted" && rec.final_answer && rec.final_answer !== rec.suggested_answer && (
        <p className="mt-2 text-xs text-muted-foreground">You accepted your own edited version: {rec.final_answer}</p>
      )}

      {coaching && (
        <div className="mt-4 space-y-2">
          {rec.coach_messages.length > 0 && (
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border bg-background/40 p-3">
              {rec.coach_messages.map((m, i) => (
                <div key={i} className={m.role === "coach" ? "text-sm" : "text-sm text-primary"}>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {m.role === "coach" ? "Coach" : "You"}
                  </span>
                  <p className="whitespace-pre-line">{m.text}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => coach("why")}>
              {busy === "coach-why" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="mr-1 h-3.5 w-3.5" />}
              Why is this better?
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => coach("alternative")}>
              {busy === "coach-alternative" && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Show me a different option
            </Button>
          </div>
          <div className="flex gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={rec.follow_up_question ? "Answer the question, or ask the coach anything about this…" : "Ask the coach anything about this…"}
              rows={2}
              className="text-sm"
            />
            <Button
              size="icon"
              className="shrink-0 self-end"
              disabled={busy !== null || !message.trim()}
              onClick={() => coach("message")}
              title={`Send (${STRATEGY_COACH_CREDIT_COST} credit)`}
            >
              {busy === "coach-message" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Each coach reply uses {STRATEGY_COACH_CREDIT_COST} credit.</p>
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} className="text-sm" />
          {draftBlanks.length > 0 ? (
            <p className="text-xs text-amber-300">
              Still to fill in: {draftBlanks.join(", ")} — replace each one (including the brackets) with your real
              details. If you don&apos;t have that information, delete that part of the sentence.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy !== null || draftBlanks.length > 0 || !draft.trim()}
              onClick={() => decide({ action: "accept", finalAnswer: draft }, "edit")}
            >
              {busy === "edit" && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Accept my edited version
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {attesting && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="text-sm"
            placeholder="What backs this up? e.g. booking records, a supplier contract, a client's written results."
          />
          <p className="text-[11px] text-muted-foreground">
            Briefly say what proves it (a few words is enough), then click Save. Your presentation will state this only
            as your own report — never as independently verified.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy !== null || note.trim().length < 5} onClick={() => decide({ action: "attest", note }, "attest")}>
              {busy === "attest" && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Save and keep this claim
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAttesting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!editing && !attesting && (
        <div className="mt-4 flex flex-wrap gap-2">
          {decided ? (
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => decide({ action: "reset" }, "reset")}>
              Change my decision
            </Button>
          ) : (
            <>
              {hasSuggestion && suggestionBlanks.length === 0 && (
                <Button size="sm" disabled={busy !== null} onClick={() => decide({ action: "accept" }, "accept")}>
                  {busy === "accept" && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  Accept
                </Button>
              )}
              {hasSuggestion && suggestionBlanks.length > 0 && rec.field_id !== "general" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setDraft(rec.suggested_answer);
                    setEditing(true);
                  }}
                >
                  Fill in the blanks
                </Button>
              )}
              {rec.field_id !== "general" && !(hasSuggestion && suggestionBlanks.length > 0) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraft(rec.suggested_answer || rec.original_answer);
                    setEditing(true);
                  }}
                >
                  {hasSuggestion ? "Edit, then accept" : "Write my answer"}
                </Button>
              )}
              {rec.is_critical ? (
                <>
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => decide({ action: "exclude" }, "exclude")}>
                    Remove this claim
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAttesting(true)}>
                    It&apos;s true — I can back it up
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => decide({ action: "reject" }, "reject")}>
                  Keep my original
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => decide({ action: "needs_info" }, "needs_info")}>
                Needs more information
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
