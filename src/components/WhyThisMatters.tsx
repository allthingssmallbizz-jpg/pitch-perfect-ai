"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { FIELD_EDUCATION } from "@/lib/education";

// A small, collapsed-by-default "why does this matter" toggle for jargon-heavy discovery
// fields — separate from the always-visible per-field hint (which covers "how do I answer this"),
// this covers the deeper "why does the AI need it / what breaks if I skip it" question a total
// beginner has but an experienced marketer doesn't need cluttering the form by default.
export default function WhyThisMatters({ fieldKey }: { fieldKey: string }) {
  const [open, setOpen] = useState(false);
  const entry = FIELD_EDUCATION[fieldKey];
  if (!entry) return null;

  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary"
      >
        <HelpCircle className="h-3 w-3" />
        Why this matters
      </button>
      {open && (
        <div className="mt-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <p>{entry.why}</p>
          {entry.usedIn && (
            <p className="mt-1 text-[11px]">
              <span className="font-medium text-foreground">Used in:</span> {entry.usedIn}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
