"use client";

import { useActionState } from "react";
import { createProject } from "@/lib/actions/projects";

export default function NewProjectPage() {
  const [state, formAction, pending] = useActionState(createProject, undefined);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold">Name your project</h1>
      <form action={formAction} className="space-y-4">
        <input
          name="name"
          placeholder="e.g. Caregiver Burnout Coaching Offer"
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
        />
        {state && "error" in state && state.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {pending ? "Creating..." : "Create project"}
        </button>
      </form>
    </div>
  );
}
