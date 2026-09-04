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

// Only rendered when the server component already determined a bio somewhere on this account is
// incomplete (see the agent landing page, src/app/(app)/agents/[assetType]/page.tsx — "somewhere
// on this account" because that page has no project context yet to check one specific bio
// against, mirroring the sidebar's own account-wide Start Here badge in layout.tsx). Dismissible —
// a corner X, clicking outside, and an explicit Back button all close it — per Aaron: this is a
// reminder pointing at where the real requirement lives, not the enforcement itself. Nothing is
// actually unlocked by dismissing it: every hard gate downstream (the project page, the generate
// pages, the API routes) still checks the same bio independently.
export default function BioReminderDialog({ returnTo }: { returnTo?: string }) {
  const [open, setOpen] = useState(true);
  const bioHref = returnTo ? `/bio?returnTo=${encodeURIComponent(returnTo)}` : "/bio";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finish your bio before this agent will open</DialogTitle>
          <DialogDescription>
            A bio on your account isn&apos;t finished yet — every agent needs your &quot;I
            Help&quot; statement, your story, and the rest of your presenter bio to write real
            credibility and Opening Story beats instead of something generic.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Back
          </Button>
          <Button asChild>
            <Link href={bioHref}>Finish my bio</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
