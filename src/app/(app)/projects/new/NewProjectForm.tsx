"use client";

import { useActionState } from "react";
import { createProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// One project = one niche bio, auto-created and named after the project itself (see
// createProject in src/lib/actions/projects.ts) — no separate "name your niche" step. Right after
// this, the member lands on that bio's fill-in page, which shows this exact project name as its
// own heading, so the name follows them into the next step instead of getting lost.
export default function NewProjectForm({
  type,
  atNicheLimit,
  nicheLimitMessage,
}: {
  type: string | null;
  atNicheLimit: boolean;
  nicheLimitMessage: string;
}) {
  const [state, formAction, pending] = useActionState(createProject, undefined);

  if (atNicheLimit) {
    return (
      <div className="card-elevated space-y-2 rounded-2xl p-8">
        <p className="text-sm font-medium text-destructive">You&apos;ve reached your project limit.</p>
        <p className="text-sm text-muted-foreground">{nicheLimitMessage}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card-elevated space-y-4 rounded-2xl p-8">
      {type && <input type="hidden" name="type" value={type} />}
      <Input name="name" placeholder="e.g. Caregiver Burnout Coaching Offer" required />
      {state && "error" in state && state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating..." : "Create project"}
      </Button>
    </form>
  );
}
