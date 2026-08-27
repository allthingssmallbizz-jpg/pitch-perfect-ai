"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";

// Reuses the existing generic DELETE /api/generations/[id] route (getOwnedGeneration already
// confirms this user owns it) — no new backend needed, this is just a trigger for it from the
// "Recent runs" list so it doesn't quietly fill up with old lists nobody wants back.
export default function DeleteHeadlineRunButton({
  generationId,
  isOpen,
}: {
  generationId: string;
  // Whether this is the run currently shown on screen — deleting it needs to also clear the
  // form/results, not just refresh the list underneath them.
  isOpen: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this set of headlines? This can't be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/generations/${generationId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Deleted");
      if (isOpen) router.push("/headline-lab");
      else router.refresh();
    } catch {
      toast.error("Could not delete — try again.");
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="shrink-0 rounded-md border border-border bg-card/40 p-2 text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
      title="Delete this run"
      aria-label="Delete this run"
    >
      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
