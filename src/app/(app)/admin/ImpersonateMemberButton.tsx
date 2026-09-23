"use client";

import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminImpersonateMember } from "@/lib/actions/admin";

// "Log in as this member" — opens their account exactly as they see it, no password involved.
// Confirmed with a plain window.confirm() rather than a dialog, same weight as
// RevokeAccessButton: it switches this browser tab's active session immediately, but it's fully
// reversible with one click ("Return to admin" — see the banner in (app)/layout.tsx) and never
// touches the member's actual credentials.
export default function ImpersonateMemberButton({ userId, email }: { userId: string; email: string }) {
  return (
    <form
      action={adminImpersonateMember}
      onSubmit={(e) => {
        if (!window.confirm(`Log in as ${email}? This switches this browser tab to their account — use "Return to admin" to come back.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-xs">
        <LogIn className="mr-1 h-3 w-3" />
        Log in as
      </Button>
    </form>
  );
}
