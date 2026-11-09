"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Agent } from "@/lib/agents/config";
import { getAgentAvatarDataUri } from "@/lib/agents/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// While a long generation runs, the agent doing the work pops up at a little laptop — slides
// typing onto the screen, keys tapping — and talks to the member in a speech bubble that changes
// as the minutes pass. Replaces the old static "Still working…" line, which made a perfectly
// healthy multi-minute run feel stuck. The messages are friendly narration, not real progress:
// there is no per-slide progress signal to report.

export type AgentTask = "deck" | "script" | "other";

type Line = { at: number; text: (name: string, deliverable: string) => string };

const SCRIPTS: Record<AgentTask, Line[]> = {
  deck: [
    { at: 0, text: (n) => `Hi, I'm ${n}! I'm starting on your signature webinar right now.` },
    { at: 12, text: () => "Reading through your blueprint and Discovery answers…" },
    { at: 28, text: () => "Laying out your story — the hook, your origin story, and the big promise." },
    { at: 50, text: () => "Building your slides one at a time. This part takes a few minutes." },
    { at: 85, text: () => "Your teaching sections are coming together, slide by slide." },
    { at: 120, text: () => "Stacking your value and bonuses so every item gets its moment." },
    { at: 160, text: () => "We're almost there — polishing headlines and speaker notes." },
    { at: 210, text: () => "Just a few more slides. Thanks for hanging in there with me!" },
  ],
  script: [
    { at: 0, text: (n) => `Hi, I'm ${n}! I'm writing what you'll say on every slide.` },
    { at: 12, text: () => "Reading through your deck so every word lines up with your slides…" },
    { at: 30, text: () => "Writing your opening — the part that hooks them in the first minute." },
    { at: 55, text: () => "Working through your teaching sections, one slide at a time." },
    { at: 90, text: () => "Writing the words for your offer and value stack." },
    { at: 130, text: () => "Almost there — smoothing the transitions between slides." },
    { at: 180, text: () => "Just a few more slides to go. Thanks for your patience!" },
  ],
  other: [
    { at: 0, text: (n, d) => `Hi, I'm ${n}! I'm starting on your ${d} right now.` },
    { at: 12, text: () => "Pulling in your Discovery answers and your Bio…" },
    { at: 30, text: () => "Writing it with the Pitch Perfect Method™ — give me a minute." },
    { at: 60, text: () => "Putting it together piece by piece." },
    { at: 100, text: () => "We're almost there — polishing the final details." },
    { at: 150, text: () => "Longer pieces can take a few minutes. Thanks for hanging in there!" },
  ],
};

function currentLine(task: AgentTask, seconds: number, name: string, deliverable: string): string {
  const lines = SCRIPTS[task];
  let line = lines[0];
  for (const l of lines) if (seconds >= l.at) line = l;
  return line.text(name, deliverable);
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// The little desk scene: agent behind a laptop whose screen fills with "slide" lines.
function Scene({ agent, compact = false }: { agent: Agent; compact?: boolean }) {
  const lines = [
    { width: "70%", delay: "0s", strong: true },
    { width: "88%", delay: "0.6s" },
    { width: "62%", delay: "1.2s" },
    { width: "80%", delay: "1.8s" },
  ];
  return (
    <div className={cn("relative flex shrink-0 flex-col items-center", compact ? "w-28" : "w-36")} aria-hidden>
      <Avatar
        className={cn(
          "pp-agent-bob z-0 rounded-xl border border-primary/30 bg-primary/10",
          compact ? "h-12 w-12" : "h-16 w-16"
        )}
      >
        <AvatarImage src={getAgentAvatarDataUri(agent)} alt="" />
        <AvatarFallback>{agent.emoji}</AvatarFallback>
      </Avatar>
      {/* Laptop screen */}
      <div
        className={cn(
          "relative z-10 -mt-2 rounded-t-md border border-primary/40 bg-slate-950 p-1.5 shadow-lg shadow-primary/10",
          compact ? "h-16 w-28" : "h-20 w-36"
        )}
      >
        <div className="flex h-full flex-col gap-1 overflow-hidden rounded-sm bg-gradient-to-br from-slate-900 to-slate-950 p-1.5">
          {lines.map((l, i) => (
            <div
              key={i}
              className={cn("pp-type-line h-1.5 rounded-full", l.strong ? "bg-primary" : "bg-slate-500/80")}
              style={{ ["--pp-line-width" as string]: l.width, animationDelay: l.delay }}
            />
          ))}
          <div className="mt-auto flex items-center gap-1">
            <div className="h-2.5 w-4 rounded-[2px] bg-primary/30" />
            <div className="h-2.5 w-4 rounded-[2px] bg-primary/30" />
            <span className="pp-cursor-blink ml-auto h-2.5 w-0.5 bg-primary" />
          </div>
        </div>
      </div>
      {/* Laptop base + tapping keys */}
      <div className={cn("relative z-10 h-2 rounded-b-md bg-slate-600", compact ? "w-32" : "w-40")}>
        <div className="absolute inset-x-6 top-0.5 flex justify-between">
          {[0, 0.15, 0.3, 0.45].map((d) => (
            <span key={d} className="pp-key-tap h-1 w-2 rounded-[1px] bg-slate-300" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="ml-1 inline-flex items-end gap-0.5 align-middle" aria-hidden>
      {[0, 0.15, 0.3].map((d) => (
        <span key={d} className="pp-dot-bounce h-1 w-1 rounded-full bg-current" style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

export default function AgentAtWork({
  agent,
  task,
  deliverable,
  elapsedSeconds,
  variant = "floating",
  canLeave = true,
}: {
  agent: Agent;
  task: AgentTask;
  // How the work is named in "I'm starting on your ___" (used by the generic script).
  deliverable: string;
  elapsedSeconds: number;
  // floating: a pop-up in the corner that doesn't block the page; inline: fills a placeholder card.
  variant?: "floating" | "inline";
  // Whether it's safe to click away (the chained deck/script builds notify wherever you are).
  canLeave?: boolean;
}) {
  const [minimized, setMinimized] = useState(false);
  const name = agent.name.replace(/^Agent\s+/, "");
  const message = currentLine(task, elapsedSeconds, name, deliverable);
  const footer = canLeave
    ? "Feel free to keep working — I'll let you know the moment it's ready."
    : "No need to refresh — I'll show it right here when it's done.";

  if (variant === "inline") {
    return (
      <div className="card-elevated flex flex-col items-center gap-5 rounded-2xl border-dashed p-8 text-center sm:flex-row sm:text-left">
        <Scene agent={agent} />
        <div className="min-w-0 flex-1" role="status" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {agent.name} is working · {clock(elapsedSeconds)}
          </p>
          <p className="mt-2 text-base font-medium text-foreground">
            {message}
            <TypingDots />
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{footer}</p>
        </div>
      </div>
    );
  }

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="pp-pop-in fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-primary/40 bg-card px-3 py-2 text-sm shadow-xl shadow-black/40"
      >
        <Avatar className="pp-agent-bob h-7 w-7 rounded-lg bg-primary/10">
          <AvatarImage src={getAgentAvatarDataUri(agent)} alt="" />
          <AvatarFallback>{agent.emoji}</AvatarFallback>
        </Avatar>
        <span className="font-medium">{name} is working</span>
        <span className="tabular-nums text-muted-foreground">{clock(elapsedSeconds)}</span>
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div
      className="pp-pop-in fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-primary/40 bg-card p-4 shadow-2xl shadow-black/50 sm:inset-x-auto sm:right-4 sm:w-[23rem]"
      role="status"
      aria-live="polite"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {agent.name} · {agent.title}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">{clock(elapsedSeconds)}</span>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Minimize"
            title="Minimize"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex items-end gap-3">
        <Scene agent={agent} compact />
        <div className="relative mb-6 min-w-0 flex-1 rounded-2xl rounded-bl-sm border border-border bg-background/60 px-3 py-2 text-sm text-foreground">
          {message}
          <TypingDots />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{footer}</p>
    </div>
  );
}
