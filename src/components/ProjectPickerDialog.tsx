"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Shown the moment someone clicks into an agent from the dashboard/sidebar with no project
// context at all — this landing page (see agents/[assetType]/page.tsx) never carries one, so
// without this there was no way to say "use this agent on my existing Travel Academy project,"
// only "start a brand-new one" or reopen a specific past generation. Dismissible (unlike
// BioReminderDialog/DiscoveryBlockedDialog) since it's a navigation shortcut, not a data-integrity
// gate — closing it just leaves the normal page (Start a new project, Past generations) intact
// underneath. Only ever rendered once the account-wide bio/discovery gates above it have already
// cleared, so every project listed here is one this agent can actually run for.
export default function ProjectPickerDialog({
  projects,
  assetType,
  agentName,
}: {
  projects: { id: string; name: string }[];
  assetType: string;
  agentName: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Which project is this for?</DialogTitle>
          <DialogDescription>
            You&apos;re not inside a project right now — pick one below to use {agentName} on it.
            Or close this to start a new project instead, or browse past generations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}?intent=${assetType}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:text-primary"
            >
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{p.name}</span>
            </Link>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
