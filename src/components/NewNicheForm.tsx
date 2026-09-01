"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createBioProfile } from "@/lib/actions/presenterBio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// createBioProfile redirects straight into /bio/[id] on success, so the only state this ever
// actually renders is the tier-limit error (canCreateBioProfile) when it doesn't.
export default function NewNicheForm({ disabled, limitMessage }: { disabled: boolean; limitMessage?: string }) {
  const [state, action, pending] = useActionState(createBioProfile, undefined);

  if (disabled) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        {limitMessage}
      </div>
    );
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <Input name="label" placeholder="e.g. Travel Agent, Diabetes Coach" className="max-w-xs" required />
      <Button type="submit" disabled={pending}>
        <Plus className="mr-1.5 h-4 w-4" />
        {pending ? "Creating…" : "New niche"}
      </Button>
      {state && "error" in state && state.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}
