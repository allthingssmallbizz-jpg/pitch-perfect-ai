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

// Only rendered when the server component already determined THIS project's discovery brief is
// missing a required field (see projectNeedsDiscovery/REQUIRED_DISCOVERY_FIELDS in
// src/lib/projects.ts) — currently generate/[assetType]/page.tsx and ad-image/page.tsx, replacing
// what used to be a silent redirect straight back to the project page with no explanation of why.
// Deliberately NOT dismissible, same as BioReminderDialog and for the same reason: an agent
// genuinely shouldn't open for a project whose brief isn't finished, so this is the actual gate,
// not a reminder pointing at one that lives elsewhere.
export default function DiscoveryBlockedDialog({
  projectId,
  projectName,
  intent,
  missingFields,
}: {
  projectId: string;
  projectName: string;
  intent: string;
  missingFields: string[];
}) {
  const href = `/projects/${projectId}?intent=${intent}#discovery-form`;

  return (
    <Dialog open>
      <DialogContent hideClose onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Finish {projectName}&apos;s discovery brief first</DialogTitle>
          <DialogDescription>
            Every agent needs a complete discovery brief to write real, on-target copy for{" "}
            {projectName} instead of something generic. You can&apos;t proceed to this agent until
            it&apos;s filled in.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Still missing: {missingFields.join(", ")}.</p>
        <DialogFooter>
          <Button asChild>
            <Link href={href}>Finish discovery brief</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
