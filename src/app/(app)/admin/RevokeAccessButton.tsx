"use client";

import { ShieldOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminRevokeAccess, adminRestoreAccess } from "@/lib/actions/admin";

// Reversible — Revoke sets access_expires_at to now and bans the auth account (blocks both
// generating and logging in); Restore undoes both. Confirmed with a plain window.confirm()
// rather than the typed-name dialog DeleteMemberButton uses, since this doesn't destroy
// anything — Restore is always one click away.
export default function RevokeAccessButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  if (isActive) {
    return (
      <form
        action={adminRevokeAccess}
        onSubmit={(e) => {
          if (!window.confirm("Revoke this member's access? They'll be signed out and blocked from logging in until you restore access.")) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="userId" value={userId} />
        <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-xs text-destructive hover:text-destructive">
          <ShieldOff className="mr-1 h-3 w-3" />
          Revoke access
        </Button>
      </form>
    );
  }

  return (
    <form action={adminRestoreAccess}>
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-xs">
        <ShieldCheck className="mr-1 h-3 w-3" />
        Restore access
      </Button>
    </form>
  );
}
