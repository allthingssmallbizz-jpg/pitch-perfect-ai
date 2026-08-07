"use client";

import { useActionState } from "react";
import { createProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewProjectPage() {
  const [state, formAction, pending] = useActionState(createProject, undefined);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 font-display text-2xl font-semibold text-gradient-silver">Name your project</h1>
      <form action={formAction} className="card-elevated space-y-4 rounded-2xl p-8">
        <Input name="name" placeholder="e.g. Caregiver Burnout Coaching Offer" required />
        {state && "error" in state && state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating..." : "Create project"}
        </Button>
      </form>
    </div>
  );
}
