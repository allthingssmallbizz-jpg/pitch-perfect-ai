"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wand2, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TEXT_EDIT_CREDIT_COST } from "@/lib/ai/generators/textEdit";
import { getAgent } from "@/lib/agents/config";
import { COURSE_ASSET_TYPES } from "@/lib/ai/courseModules";
import type { AssetType } from "@/types/database";

// Agent Polly's own Update Script rewrites a whole separate asset (webinar_script) in one click.
// Build Module Slides has no separate script asset — bullets and speaker notes are one
// generation — so the equivalent "I don't like the notes, redo them, but don't touch my slides"
// action is a PRESET instruction sent through this same targeted-edit endpoint rather than a
// different generator/route. Explicitly scoped to notes only so it can never quietly reshuffle
// the slide structure a member already approved.
const UPDATE_SCRIPT_INSTRUCTION =
  "Rewrite ONLY the speaker notes for every single slide — do not change any slide's title or on-slide bullets, and do not add, remove, or reorder any slides. For each slide, write ONE short, continuous, natural-sounding passage — a HARD CAP of 5-7 sentences TOTAL per slide (not per bullet; the whole note should read aloud in under 30 seconds) — that briefly touches on every bullet on that slide, in order, about one sentence per bullet. Use AT MOST ONE concrete example for the entire slide, not one per bullet. Never write it as an annotated breakdown (\"First bullet:\", \"Second bullet:\", \"For the next point...\") — a presenter would never say those labels out loud, so they must never appear; write it as one flowing thought a real presenter would actually say. It still must correlate to the slide's own bullets, not generic scene-setting disconnected from them, and must not re-explain content an earlier slide already covered just because it flows naturally as a story — once a slide's bullets move to a new topic, its notes move with them. Copy every slide's title and bullets into the output completely unchanged.";

// Course Outline's (and Cora's three module-scoped tools') equivalent of PageEditPanel — a plain
// "tell it what to add, remove, or change" box that applies a targeted edit to the already-
// generated content instead of a full regenerate, via the same /api/generations/[id]/edit
// endpoint's markdown-editable branch (see that route's TEXT_EDITABLE_ASSET_TYPES). No image/
// video handling here — none of that applies to a plain text document. Reachable the same way
// whether the generation being edited was opened from "Past generations" or from Agent Cora's
// Completed Courses section — this isn't gated by which list it was opened from, only by
// assetType + having a generationId, so a member fixing a wrong speaker note on an already-
// Completed module's slides doesn't need to leave Completed or hit Regenerate to do it.
const CONTENT_LABELS: Partial<Record<AssetType, string>> = {
  course_outline: "course",
  webinar_outline: "webinar blueprint",
  vsl_script: "VSL script",
  course_module_slides: "module's slides",
  course_module_quiz: "module's quiz",
  course_module_workbook: "module's workbook",
};

const PLACEHOLDERS: Partial<Record<AssetType, string>> = {
  course_outline: `e.g. "Add a module on pricing between Module 3 and Module 4" or "Remove the community accountability section" or "Rename Module 2 to 'Find Your Signature Offer'"`,
  webinar_outline: `e.g. "Add a case study to Phase 4" or "Change the CTA in Phase 7 to 'Book a call'" or "Remove the poll question in Phase 1"`,
  vsl_script: `e.g. "Rewrite Beat 4 (Big Promise) so it doesn't announce itself" or "Add a stronger proof point to Stage 15" or "Shorten the Opening Story, it's running long"`,
  course_module_slides: `e.g. "Rewrite the speaker notes on Slide 7 to explain the pricing objection" or "Add a slide after Slide 10 covering follow-up emails" or "Fix the bullet on Slide 4, it's inaccurate"`,
  course_module_quiz: `e.g. "Add a question about handling the pricing objection" or "Fix the answer key for question 3" or "Remove question 5, it doesn't fit this module"`,
  course_module_workbook: `e.g. "Add a reflection prompt after Lesson 2" or "Fix the completion checklist at the end" or "Make the pricing worksheet more specific"`,
};

// The "want this to stick permanently" footnote — each root asset (Course Outline, Webinar
// Blueprint, VSL Script) has its own relationship to Discovery/downstream builds, so each needs
// its own version of "here's where a permanent change actually belongs instead." Module-scoped
// tools share one version since they all point back to the same Course Outline.
const PERMANENCE_HINTS: Partial<Record<AssetType, string>> = {
  course_outline:
    " For a change you want to stick permanently (and also show up in every module's slides/quiz/workbook), add it to this project's Discovery Notes instead.",
  webinar_outline:
    " For a change you want to stick permanently (and also show up when you build or rebuild Your Signature Webinar from this), add it to this project's Discovery Notes instead.",
  vsl_script:
    " For a change you want to stick permanently, add it to this project's Discovery Notes instead — Regenerate starts this script over fresh from Discovery, so a one-off edit here wouldn't carry forward either way.",
};
const DEFAULT_PERMANENCE_HINT =
  " If you want a change to also apply the next time you rebuild this module from scratch, update the Course Outline itself too — this only fixes the copy you already have.";

export default function TextEditPanel({
  generationId,
  assetType,
  onApplied,
}: {
  generationId: string;
  assetType: AssetType;
  onApplied: (newContent: string) => void;
}) {
  const contentLabel = CONTENT_LABELS[assetType] ?? "content";
  const placeholder = PLACEHOLDERS[assetType] ?? PLACEHOLDERS.course_outline!;
  // getAgent(assetType)?.name is e.g. "Agent Sarah" or "Agent Cora" — this panel is shared across
  // several agents' own root assets, so the name in its own copy has to follow assetType rather
  // than being hardcoded to whichever agent this was first built for.
  const agentName = getAgent(assetType)?.name ?? "the AI";
  const permanenceHint = PERMANENCE_HINTS[assetType] ?? DEFAULT_PERMANENCE_HINT;
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
  // Distinguishes the preset "Update Script" action from the free-text box below for disabling/
  // loading state — both share applyInstruction and can't run at the same time, but each needs
  // its own button to show its own spinner rather than both lighting up together.
  const [updatingScript, setUpdatingScript] = useState(false);

  async function applyInstruction(instructionText: string, appliedLabel: string): Promise<boolean> {
    setLastApplied(null);
    setLastError(null);
    try {
      const res = await fetch(`/api/generations/${generationId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: instructionText }),
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
      setLastApplied(appliedLabel);
      toast.success("Updated!");
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not apply that update.";
      setLastError(message);
      toast.error(message);
      return false;
    }
  }

  async function handleApply() {
    if (!instruction.trim()) {
      toast.error("Describe what to add, remove, or change first.");
      return;
    }
    setApplying(true);
    const appliedInstruction = instruction;
    const ok = await applyInstruction(appliedInstruction, appliedInstruction);
    if (ok) setInstruction("");
    setApplying(false);
  }

  async function handleUpdateScript() {
    setUpdatingScript(true);
    await applyInstruction(UPDATE_SCRIPT_INSTRUCTION, "Speaker notes rewritten for every slide");
    setUpdatingScript(false);
  }

  const anyBusy = applying || updatingScript;

  return (
    <div className="card-elevated rounded-xl p-4">
      {assetType === "course_module_slides" && (
        <div className="mb-4 border-b border-border/60 pb-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
            <RefreshCw className="h-4 w-4" />
            Update Script
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Don&apos;t like how the speaker notes came out? Rewrite all of them fresh — this keeps
            every slide&apos;s title and bullets exactly as they are, only the notes change. No
            need to Regenerate the whole deck for this.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={handleUpdateScript} disabled={anyBusy}>
            {updatingScript ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {updatingScript ? "Rewriting speaker notes..." : `Update Script (${TEXT_EDIT_CREDIT_COST} credits)`}
          </Button>
        </div>
      )}
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <Wand2 className="h-4 w-4" />
        Add, remove, or change something
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Tell {agentName} exactly what to add, take out, or change in the {contentLabel} above —
        and only that changes. Everything else
        {COURSE_ASSET_TYPES.includes(assetType) && ", including anything you’ve already marked Completed,"}{" "}
        stays exactly as it is. Heads up: this only changes what&apos;s shown above — hitting{" "}
        <strong>Regenerate</strong> later starts over completely fresh and will lose it.
        {permanenceHint}
      </p>
      <Textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder={placeholder}
        rows={3}
        disabled={anyBusy}
      />
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" onClick={handleApply} disabled={anyBusy}>
          {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          {applying ? "Working..." : `Apply update (${TEXT_EDIT_CREDIT_COST} credits)`}
        </Button>
      </div>
      {lastApplied && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Updated: &quot;{lastApplied}&quot; — scroll down to see the change reflected below.
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
