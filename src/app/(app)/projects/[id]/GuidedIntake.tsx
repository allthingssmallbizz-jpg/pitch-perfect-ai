"use client";

import { useActionState, useState } from "react";
import { updateProjectDiscovery } from "@/lib/actions/projects";
import { GUIDED_REQUIRED_QUESTIONS, GUIDED_OPTIONAL_QUESTIONS, type GuidedQuestion } from "@/lib/guidedIntake";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, CheckCircle2, ListChecks } from "lucide-react";
import type { Project } from "@/types/database";

type Phase = "required" | "interstitial" | "optional" | "review";

const ALL_QUESTIONS: GuidedQuestion[] = [...GUIDED_REQUIRED_QUESTIONS, ...GUIDED_OPTIONAL_QUESTIONS];

function getProjectField(project: Project, key: string): string {
  if (key === "name") return project.name;
  return String((project as unknown as Record<string, unknown>)[key] ?? "");
}

function initialAnswers(project: Project): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of ALL_QUESTIONS) out[q.key] = getProjectField(project, q.key);
  return out;
}

// The plain-English front door for someone who's never filled out a marketing brief before —
// one question at a time instead of DiscoveryForm's 25-field wall of jargon. Saves through the
// exact same server action DiscoveryForm uses, so nothing about how a brief is stored changes;
// this only changes how it's collected. Every field the action expects always has a hidden
// input tracking the shared `answers` state, so a submit from ANY step carries the complete
// brief — never just whatever the current question happened to be.
export default function GuidedIntake({
  project,
  redirectTo,
  onSwitchToFullForm,
}: {
  project: Project;
  redirectTo: string | null;
  onSwitchToFullForm: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateProjectDiscovery, undefined);
  const [answers, setAnswers] = useState<Record<string, string>>(() => initialAnswers(project));
  const [phase, setPhase] = useState<Phase>("required");
  const [requiredIndex, setRequiredIndex] = useState(0);
  const [optionalIndex, setOptionalIndex] = useState(0);
  const [showValidation, setShowValidation] = useState(false);

  function setAnswer(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  const requiredQuestion = GUIDED_REQUIRED_QUESTIONS[requiredIndex];
  const optionalQuestion = GUIDED_OPTIONAL_QUESTIONS[optionalIndex];

  function advanceRequired() {
    setShowValidation(false);
    if (requiredIndex + 1 < GUIDED_REQUIRED_QUESTIONS.length) {
      setRequiredIndex(requiredIndex + 1);
    } else {
      setPhase("interstitial");
    }
  }

  function goNextRequired() {
    if (requiredQuestion.required && !answers[requiredQuestion.key]?.trim()) {
      setShowValidation(true);
      return;
    }
    advanceRequired();
  }

  function goBackRequired() {
    setShowValidation(false);
    if (requiredIndex > 0) setRequiredIndex(requiredIndex - 1);
  }

  function goNextOptional() {
    if (optionalIndex + 1 < GUIDED_OPTIONAL_QUESTIONS.length) {
      setOptionalIndex(optionalIndex + 1);
    } else {
      setPhase("review");
    }
  }

  function goBackOptional() {
    if (optionalIndex > 0) setOptionalIndex(optionalIndex - 1);
    else setPhase("interstitial");
  }

  const totalRequiredSteps = GUIDED_REQUIRED_QUESTIONS.length;
  const progressPct =
    phase === "required"
      ? Math.round(((requiredIndex + 1) / totalRequiredSteps) * 60)
      : phase === "optional"
        ? 60 + Math.round(((optionalIndex + 1) / GUIDED_OPTIONAL_QUESTIONS.length) * 35)
        : 100;

  function handleEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (phase === "required") goNextRequired();
    else if (phase === "optional") goNextOptional();
  }

  function renderInput(q: GuidedQuestion) {
    const value = answers[q.key] ?? "";
    if (q.type === "choice") {
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.choices?.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setAnswer(q.key, c.value)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                value === c.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="text-sm font-medium">{c.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{c.hint}</div>
            </button>
          ))}
        </div>
      );
    }
    if (q.type === "textarea") {
      return (
        <Textarea
          autoFocus
          rows={4}
          value={value}
          onChange={(e) => setAnswer(q.key, e.target.value)}
          placeholder={q.placeholder}
          className="text-base"
        />
      );
    }
    return (
      <Input
        autoFocus
        value={value}
        onChange={(e) => setAnswer(q.key, e.target.value)}
        onKeyDown={handleEnter}
        placeholder={q.placeholder}
        className="text-base"
      />
    );
  }

  if (state && "success" in state && state.success) {
    return (
      <div className="card-elevated space-y-4 rounded-2xl p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
        <h3 className="font-display text-lg font-semibold">Saved! Your project is ready to generate.</h3>
        <p className="text-sm text-muted-foreground">
          Scroll up to your launch roadmap to get started, or review everything you just entered.
        </p>
        <Button type="button" variant="outline" onClick={onSwitchToFullForm}>
          Review or edit your full brief
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="card-elevated space-y-6 rounded-2xl p-6">
      <input type="hidden" name="projectId" value={project.id} />
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
      <input type="hidden" name="mode" value={project.mode} />
      <input type="hidden" name="funnel_type" value={project.funnel_type} />
      {ALL_QUESTIONS.map((q) => (
        <input key={q.key} type="hidden" name={q.key} value={answers[q.key] ?? ""} />
      ))}

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Guided setup</span>
          <button type="button" onClick={onSwitchToFullForm} className="text-primary hover:underline">
            Switch to the full form instead
          </button>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {phase === "required" && requiredQuestion && (
        <div className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">{requiredQuestion.section}</p>
          <h3 className="font-display text-lg font-semibold">{requiredQuestion.question}</h3>
          {requiredQuestion.helper && <p className="text-sm text-muted-foreground">{requiredQuestion.helper}</p>}
          {renderInput(requiredQuestion)}
          {showValidation && (
            <p className="text-xs text-amber-400">
              This one helps every generator a lot — give it your best guess, or{" "}
              <button type="button" onClick={advanceRequired} className="underline">
                fill it in later
              </button>
              .
            </p>
          )}
          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="ghost" onClick={goBackRequired} disabled={requiredIndex === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <span className="text-xs text-muted-foreground">
              {requiredIndex + 1} of {totalRequiredSteps}
            </span>
            <Button type="button" onClick={goNextRequired}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {phase === "interstitial" && (
        <div className="space-y-4 py-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
          <h3 className="font-display text-lg font-semibold">Nice work — that&apos;s everything needed to start generating.</h3>
          <p className="text-sm text-muted-foreground">
            You can finish here, or add a few more optional details that sharpen the copy even further.
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "I'm done — finish setup"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setPhase("optional")}>
              <ListChecks className="mr-2 h-4 w-4" />
              Add a few more details
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setPhase("required")}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← Back to review answers
          </button>
        </div>
      )}

      {phase === "optional" && optionalQuestion && (
        <div className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">{optionalQuestion.section}</p>
          <h3 className="font-display text-lg font-semibold">{optionalQuestion.question}</h3>
          {optionalQuestion.helper && <p className="text-sm text-muted-foreground">{optionalQuestion.helper}</p>}
          {renderInput(optionalQuestion)}
          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="ghost" onClick={goBackOptional}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <span className="text-xs text-muted-foreground">
              {optionalIndex + 1} of {GUIDED_OPTIONAL_QUESTIONS.length} optional
            </span>
            <Button type="button" onClick={goNextOptional}>
              {answers[optionalQuestion.key]?.trim() ? "Next" : "Skip"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setPhase("review")}
            className="block text-xs text-muted-foreground hover:underline"
          >
            Skip the rest, finish now →
          </button>
        </div>
      )}

      {phase === "review" && (
        <div className="space-y-4 py-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
          <h3 className="font-display text-lg font-semibold">All set — ready to save.</h3>
          <p className="text-sm text-muted-foreground">
            Your full brief is filled in. Save it and every generator above is ready to go.
          </p>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Finish setup"}
          </Button>
        </div>
      )}

      {state && "error" in state && state.error && <p className="text-center text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
