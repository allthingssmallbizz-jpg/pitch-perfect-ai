"use client";

import { useActionState } from "react";
import type { Project } from "@/types/database";
import { updateProjectDiscovery, deleteProject } from "@/lib/actions/projects";

function Field({
  label,
  name,
  defaultValue,
  textarea = true,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  textarea?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700">{label}</label>
      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          rows={2}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      ) : (
        <input
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      )}
    </div>
  );
}

export default function DiscoveryForm({ project }: { project: Project }) {
  const [state, formAction, pending] = useActionState(updateProjectDiscovery, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={project.id} />

      <Field label="Project name" name="name" defaultValue={project.name} textarea={false} />
      <Field
        label="One Result"
        name="one_result"
        defaultValue={project.one_result}
        placeholder="The single outcome your offer delivers"
      />
      <Field label="Who it's for" name="who_its_for" defaultValue={project.who_its_for} />
      <Field label="The problem" name="the_problem" defaultValue={project.the_problem} />
      <Field
        label="The transformation"
        name="the_transformation"
        defaultValue={project.the_transformation}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Price" name="price" defaultValue={project.price} textarea={false} />
        <div>
          <label className="block text-sm font-medium text-neutral-700">Mode</label>
          <select
            name="mode"
            defaultValue={project.mode}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="expert">Expert Mode (fast, polished)</option>
            <option value="coach">Coach Mode (asks questions first)</option>
          </select>
        </div>
      </div>
      <Field label="Bonuses" name="bonuses" defaultValue={project.bonuses} />
      <Field label="Guarantee" name="guarantee" defaultValue={project.guarantee} />
      <Field
        label="Proof"
        name="proof"
        defaultValue={project.proof}
        placeholder="Real testimonials, results, case studies — used verbatim, never invented"
      />
      <Field
        label="Additional discovery notes"
        name="discovery_notes"
        defaultValue={project.discovery_notes}
        placeholder="Verbatim customer language, objections, anything from the Discovery interviews"
      />

      <div className="flex items-center justify-between pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save discovery"}
        </button>
        {state && "success" in state && state.success && (
          <span className="text-sm text-green-600">Saved.</span>
        )}
        {state && "error" in state && state.error && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
      </div>

      <details className="pt-2">
        <summary className="cursor-pointer text-xs text-neutral-400">Delete project</summary>
        <form action={deleteProject} className="mt-2">
          <input type="hidden" name="projectId" value={project.id} />
          <button type="submit" className="text-xs text-red-600 hover:underline">
            Permanently delete this project and its generations
          </button>
        </form>
      </details>
    </form>
  );
}
