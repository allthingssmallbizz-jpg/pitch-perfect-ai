"use client";

import { useActionState } from "react";
import { createProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DeleteProjectButton from "@/components/DeleteProjectButton";

// One project = one niche bio, auto-created and named after the project itself (see
// createProject in src/lib/actions/projects.ts) — no separate "name your niche" step. Right after
// this, the member lands on that bio's fill-in page, which shows this exact project name as its
// own heading, so the name follows them into the next step instead of getting lost.
export default function NewProjectForm({
  type,
  atNicheLimit,
  nicheLimitMessage,
  activeProjects,
}: {
  type: string | null;
  atNicheLimit: boolean;
  nicheLimitMessage: string;
  // Only populated when atNicheLimit is true (see NewProjectPage) — lets someone stuck at their
  // limit delete an old project and free up a slot right here, instead of bouncing to the
  // dashboard just to do that and then having to find their way back to this form.
  activeProjects: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createProject, undefined);

  if (atNicheLimit) {
    const redirectTo = `/projects/new${type ? `?type=${type}` : ""}`;
    return (
      <div className="card-elevated space-y-4 rounded-2xl p-8">
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">You&apos;ve reached your project limit.</p>
          <p className="text-sm text-muted-foreground">{nicheLimitMessage}</p>
        </div>
        {activeProjects.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Or delete a project to free up a slot
            </p>
            <div className="space-y-1.5">
              {activeProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/30 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm">{project.name}</span>
                  <DeleteProjectButton projectId={project.id} projectName={project.name} redirectTo={redirectTo} />
                </div>
              ))}
            </div>
          </div>
        )}
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
