"use client";

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
// against, mirroring the sidebar's own account-wide Start Here badge in layout.tsx). Deliberately
// NOT dismissible: no "Not now," no corner X (hideClose), Escape and click-outside both
// suppressed below — an agent genuinely shouldn't open while any bio on the account is unfinished,
// so unlike the old soft nudge this is the actual gate, not just a reminder that the real gate
// lives downstream.
export default function BioReminderDialog({ returnTo }: { returnTo?: string }) {
  const bioHref = returnTo ? `/bio?returnTo=${encodeURIComponent(returnTo)}` : "/bio";

  return (
    <Dialog open>
      <DialogContent hideClose onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Finish your bio before this agent will open</DialogTitle>
          <DialogDescription>
            A bio on your account isn&apos;t finished yet — every agent needs your &quot;I
            Help&quot; statement, your story, and the rest of your presenter bio to write real
            credibility and Opening Story beats instead of something generic. You can&apos;t
            proceed to this agent until it&apos;s complete.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button asChild>
            <Link href={bioHref}>Finish my bio</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
