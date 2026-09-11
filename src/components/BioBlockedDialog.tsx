"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Every non-admin hitting an incomplete bio at the project level (the project page,
// generate/[assetType]/page.tsx, ad-image/page.tsx) gets a hard redirect(), never a popup — see
// those pages' own comments. This component exists ONLY for the admin-bypass case
// (isRestrictionBypassActive, src/lib/adminBypass.ts): instead of redirecting an admin who's
// flipped "Remove Restrictions" in /admin away from the page entirely, that page renders
// normally with this dismissible reminder on top of it, so the same "finish your bio first"
// message still shows without actually stopping them.
export default function BioBlockedDialog({ profileId, projectName }: { profileId: string; projectName: string }) {
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{projectName}&apos;s bio isn&apos;t finished</DialogTitle>
          <DialogDescription>
            Every agent needs this project&apos;s presenter bio to write real credibility and
            Opening Story beats instead of something generic. Restrictions are off for admins —
            you can close this and keep going.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Continue anyway
          </Button>
          <Button asChild>
            <Link href={`/bio/${profileId}`}>Finish bio</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
