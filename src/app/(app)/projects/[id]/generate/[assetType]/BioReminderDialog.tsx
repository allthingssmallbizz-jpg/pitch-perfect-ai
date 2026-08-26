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
// empty for a webinar/VSL generate page — see page.tsx. Dismissing doesn't remember anything;
// it'll ask again next visit until the bio is actually filled in, same as the Discovery
// completeness gate elsewhere in the app.
export default function BioReminderDialog() {
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finish your presenter bio first?</DialogTitle>
          <DialogDescription>
            This asset&apos;s Credibility Bridge and Opening Story beats are built from your
            presenter bio — years in the industry, your origin story, a client transformation, a
            setback you turned around. You haven&apos;t filled it in yet, so those beats will come
            back flagged as a gap instead of using your real story.
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
