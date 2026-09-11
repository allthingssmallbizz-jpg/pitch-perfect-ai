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

// Only rendered when the server component already determined THIS project's discovery brief is
// missing a required field (see projectNeedsDiscovery/REQUIRED_DISCOVERY_FIELDS in
// src/lib/projects.ts) — currently generate/[assetType]/page.tsx, ad-image/page.tsx, and the
// agent landing page's account-wide check, replacing what used to be a silent redirect straight
// back to the project page with no explanation of why. NOT dismissible by default — an agent
// genuinely shouldn't open for a project whose brief isn't finished, so this is the actual gate,
// not a reminder pointing at one that lives elsewhere — except when `dismissible` is true (an
// admin who's flipped "Remove Restrictions" in /admin — see isRestrictionBypassActive), where
// the same reminder still shows but can be closed so the demo keeps moving. Same message either
// way; only whether it can be closed changes.
export default function DiscoveryBlockedDialog({
  projectId,
  projectName,
  intent,
  missingFields,
  dismissible = false,
}: {
  projectId: string;
  projectName: string;
  intent: string;
  missingFields: string[];
  dismissible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const href = `/projects/${projectId}?intent=${intent}#discovery-form`;

  return (
    <Dialog open={open} onOpenChange={dismissible ? setOpen : undefined}>
      <DialogContent
        hideClose={!dismissible}
        onEscapeKeyDown={dismissible ? undefined : (e) => e.preventDefault()}
        onPointerDownOutside={dismissible ? undefined : (e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Finish {projectName}&apos;s discovery brief first</DialogTitle>
          <DialogDescription>
            Every agent needs a complete discovery brief to write real, on-target copy for{" "}
            {projectName} instead of something generic.{" "}
            {dismissible
              ? "Restrictions are off for admins — you can close this and keep going."
              : "You can't proceed to this agent until it's filled in."}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Still missing: {missingFields.join(", ")}.</p>
        <DialogFooter className="gap-2">
          {dismissible && (
            <Button variant="outline" onClick={() => setOpen(false)}>
              Continue anyway
            </Button>
          )}
          <Button asChild>
            <Link href={href}>Finish discovery brief</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
