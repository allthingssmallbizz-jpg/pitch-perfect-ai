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
// empty — currently just the agent landing page (src/app/(app)/agents/[assetType]/page.tsx, the
// moment someone clicks into any agent). This is deliberately still dismissible here, unlike the
// hard "finish your bio first" redirect on the actual generate/ad-image pages (see
// isPresenterBioEmpty usage there and the matching check in /api/generate/route.ts) — this page
// also doubles as the place to browse *past* generations, and blocking that outright over an
// unrelated field would be the wrong call. The real requirement lives downstream: dismissing this
// only defers finishing the bio, it doesn't skip it — the next agent they actually try to
// generate with will redirect them to /bio regardless.
export default function BioReminderDialog({ returnTo }: { returnTo?: string }) {
  const [open, setOpen] = useState(true);
  const bioHref = returnTo ? `/bio?returnTo=${encodeURIComponent(returnTo)}` : "/bio";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finish your presenter bio first</DialogTitle>
          <DialogDescription>
            Every agent needs your presenter bio — your &quot;I Help&quot; statement, your story, a
            client transformation, a setback you turned around — to write real credibility and
            Opening Story beats instead of something generic. You haven&apos;t filled it in yet,
            and generating with this agent will send you here to finish it first.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Button asChild>
            <Link href={bioHref}>Finish my bio</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
