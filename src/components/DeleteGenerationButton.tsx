"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Deletes a whole generation via DELETE /api/generations/[id] (no server action exists for
// this — see that route's comment on why the admin client is required). Used from list views
// like /agents/[assetType] where, unlike GenerateClient, there's no local list state to prune
// in place — router.refresh() re-fetches the server component instead.
export default function DeleteGenerationButton({ generationId }: { generationId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this generation? This can't be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/generations/${generationId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Could not delete.");
      }
      toast.success("Deleted");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
      setDeleting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={deleting}
      title="Delete this generation"
      className="shrink-0 text-muted-foreground hover:text-destructive"
    >
      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}
