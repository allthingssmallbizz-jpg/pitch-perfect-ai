"use client";

import { useState } from "react";
import DiscoveryForm from "./DiscoveryForm";
import GuidedIntake from "./GuidedIntake";
import type { Project } from "@/types/database";

// Picks which discovery experience to show: the guided, one-question-at-a-time wizard for
// someone starting from scratch (or mid-way through), or the full form for anyone who'd rather
// see everything at once — a returning member, someone editing a couple of fields, or anyone who
// just prefers it. Defaults to guided only while discovery is still incomplete; a project that's
// already fully filled in has nothing to "get started" on, so the full form (better for quick
// edits) is the more useful default there.
export default function DiscoveryEntry({
  project,
  redirectTo,
  discoveryComplete,
}: {
  project: Project;
  redirectTo: string | null;
  discoveryComplete: boolean;
}) {
  const [mode, setMode] = useState<"guided" | "full">(discoveryComplete ? "full" : "guided");

  if (mode === "guided") {
    return <GuidedIntake project={project} redirectTo={redirectTo} onSwitchToFullForm={() => setMode("full")} />;
  }

  return (
    <div>
      {!discoveryComplete && (
        <button
          type="button"
          onClick={() => setMode("guided")}
          className="mb-3 text-xs text-primary hover:underline"
        >
          ← Switch to guided, step-by-step setup instead
        </button>
      )}
      <DiscoveryForm project={project} redirectTo={redirectTo} />
    </div>
  );
}
