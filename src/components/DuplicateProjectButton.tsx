"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { duplicateProject } from "@/lib/actions/projects";

// A full copy of a project — its discovery brief, its own (separately editable) niche bio, and
// the current content for every asset already generated — landing straight in the new copy so a
// member adapting one offer into a second format (a small private cohort vs. the full public
// webinar launch, say) can rename and tweak it without touching the original. Non-destructive
// (nothing about the original changes), so unlike DeleteProjectButton this needs no confirmation
// step — one click, with a toast only if it couldn't go through (most likely: already at this
// account's project/niche limit).
export default function DuplicateProjectButton({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(duplicateProject, undefined);

  useEffect(() => {
    if (state && "error" in state && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        title="Duplicate this project"
        disabled={pending}
        className="text-muted-foreground hover:text-foreground"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
      </Button>
    </form>
  );
}
