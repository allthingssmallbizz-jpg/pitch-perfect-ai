"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteBioProfile } from "@/lib/actions/presenterBio";

// deleteBioProfile refuses (returns {error}) rather than orphaning a project still linked to this
// niche — that error surfaces here as a toast rather than blocking with window.confirm alone,
// since "can I delete this" isn't knowable client-side without a round trip.
export default function DeleteNicheButton({ profileId, label }: { profileId: string; label: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete the "${label}" niche? This can't be undone.`)) return;
    setDeleting(true);
    try {
      const result = await deleteBioProfile(profileId);
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Niche deleted");
      router.refresh();
    } catch {
      toast.error("Could not delete this niche.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={deleting}
      title={`Delete "${label}"`}
      className="shrink-0 text-muted-foreground hover:text-destructive"
    >
      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}
