"use client";

import { useActionState, useState } from "react";
import { createProject } from "@/lib/actions/projects";
import type { PresenterBioProfileSummary } from "@/lib/ai/presenterBio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const NEW_NICHE_VALUE = "__new__";

export default function NewProjectForm({
  type,
  niches,
  atNicheLimit,
  nicheLimitMessage,
}: {
  type: string | null;
  niches: PresenterBioProfileSummary[];
  atNicheLimit: boolean;
  nicheLimitMessage: string;
}) {
  const [state, formAction, pending] = useActionState(createProject, undefined);
  // Nothing to pick from yet — skip the picker entirely and go straight to "name your first
  // niche," same as picking "+ Create a new niche" would, just without the redundant step.
  const [nicheOption, setNicheOption] = useState(niches.length > 0 ? niches[0].id : NEW_NICHE_VALUE);

  return (
    <form action={formAction} className="card-elevated space-y-4 rounded-2xl p-8">
      {type && <input type="hidden" name="type" value={type} />}
      <Input name="name" placeholder="e.g. Caregiver Burnout Coaching Offer" required />

      <div>
        <Label htmlFor="nicheOption">Which niche is this for?</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Every project draws its presenter bio from one niche — switching niches later never
          means overwriting a bio a different project still relies on.
        </p>
        {/* The hidden input, not the visible <select>, is what actually submits — so the value
            is still present even when there's nothing to pick from yet and the <select> below
            doesn't render at all (a brand-new account with zero niches). */}
        <input type="hidden" name="nicheOption" value={nicheOption} />
        {niches.length > 0 && (
          <select
            id="nicheOption"
            value={nicheOption}
            onChange={(e) => setNicheOption(e.target.value)}
            className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {niches.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
                {n.incomplete ? " (incomplete)" : ""}
              </option>
            ))}
            {!atNicheLimit && <option value={NEW_NICHE_VALUE}>+ Create a new niche</option>}
          </select>
        )}
        {nicheOption === NEW_NICHE_VALUE &&
          (atNicheLimit && niches.length > 0 ? (
            <p className="mt-2 text-sm text-destructive">{nicheLimitMessage}</p>
          ) : (
            <Input name="newNicheLabel" placeholder="e.g. Travel Agent, Diabetes Coach" className="mt-2" required />
          ))}
      </div>

      {state && "error" in state && state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating..." : "Create project"}
      </Button>
    </form>
  );
}
