"use client";

import { useActionState } from "react";
import { createProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewProjectForm({ type }: { type: string | null }) {
  const [state, formAction, pending] = useActionState(createProject, undefined);

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
