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

// Only rendered (and only ever opens) when the server component already determined the bio is
// empty — see the agent landing page (src/app/(app)/agents/[assetType]/page.tsx, the moment
// someone clicks into any agent) and the generate page (src/app/(app)/projects/[id]/generate/
// [assetType]/page.tsx, in case they land there some other way). Generic copy rather than
// per-agent wording since getPresenterBioBlock folds the bio into every generator's system
// prompt, not just Webinar/VSL's Credibility Bridge/Opening Story beats it originally covered.
// Dismissing doesn't remember anything; it'll ask again next visit until the bio is actually
// filled in, same as the Discovery completeness gate elsewhere in the app — a nudge, not a gate.
export default function BioReminderDialog() {
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finish your presenter bio first?</DialogTitle>
          <DialogDescription>
            Every agent uses your presenter bio — your &quot;I Help&quot; statement, your story, a
            client transformation, a setback you turned around — to make hooks, headlines, and
            credibility beats sound like you instead of something generic. You haven&apos;t
            filled it in yet.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Continue without it
          </Button>
          <Button asChild>
            <Link href="/bio">Finish my bio</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
