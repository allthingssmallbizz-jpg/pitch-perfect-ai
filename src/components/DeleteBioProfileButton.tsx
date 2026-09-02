"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { deleteBioProfile } from "@/lib/actions/presenterBio";

// Only ever rendered for an orphaned bio — one whose project was already deleted elsewhere (see
// deleteBioProfile's own comment) — so unlike DeleteProjectButton this has nothing left to
// cascade: no live project, no generations tied to it, just a leftover row with no way to open
// it into anything. A plain confirm (not "type the name to confirm") is enough for that lower
// stakes — the real "are you sure" already happened when the project itself was deleted.
export default function DeleteBioProfileButton({ profileId, label }: { profileId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title="Delete this leftover bio"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;{label}&quot;?</DialogTitle>
            <DialogDescription>
              This bio&apos;s project was already deleted, so it&apos;s just a leftover — deleting
              it here can&apos;t be undone, but nothing else is affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => formRef.current?.requestSubmit()}>
              Delete bio
            </Button>
          </DialogFooter>
          <form ref={formRef} action={deleteBioProfile} className="hidden">
            <input type="hidden" name="profileId" value={profileId} />
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
