"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteProject } from "@/lib/actions/projects";

// A bare delete icon sitting directly in a list row is one accidental click away from
// permanently losing a project — unlike the discovery form's delete (tucked behind a <details>
// disclosure specifically to avoid that), this needs its own confirmation step.
export default function DeleteProjectButton({ projectId, redirectTo }: { projectId: string; redirectTo?: string }) {
  return (
    <form
      action={deleteProject}
      onSubmit={(e) => {
        if (!window.confirm("Delete this project? This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
      <Button
        variant="ghost"
        size="icon"
        type="submit"
        title="Delete this project"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </form>
  );
}
