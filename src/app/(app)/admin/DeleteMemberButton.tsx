"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { adminDeleteMember } from "@/lib/actions/admin";

// The rare, genuinely destructive option next to RevokeAccessButton's reversible revoke/restore
// — this deletes the auth account and cascades to every project, generation, and payment record
// tied to it (profiles.id -> auth.users(id) on delete cascade, and everything else cascades from
// profiles the same way). Same typed-confirmation pattern as DeleteProjectButton: typing the
// member's exact email is a much higher bar than a single reflexive click-through.
export default function DeleteMemberButton({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const matches = confirmText.trim().toLowerCase() === email.toLowerCase();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        title="Permanently delete this member"
        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
        onClick={() => {
          setConfirmText("");
          setOpen(true);
        }}
      >
        <Trash2 className="mr-1 h-3 w-3" />
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete {email}?</DialogTitle>
            <DialogDescription>
              This deletes their login and every project, generation, and payment record tied to
              their account. This can&apos;t be undone. If you just want to cut off their access
              (recoverable), cancel this and use &quot;Revoke access&quot; instead.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="confirm-member-email" className="text-sm text-muted-foreground">
              Type <span className="font-medium text-foreground">{email}</span> to confirm.
            </label>
            <Input
              id="confirm-member-email"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!matches}
              onClick={() => formRef.current?.requestSubmit()}
            >
              Delete member
            </Button>
          </DialogFooter>
          <form ref={formRef} action={adminDeleteMember} className="hidden">
            <input type="hidden" name="userId" value={userId} />
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
