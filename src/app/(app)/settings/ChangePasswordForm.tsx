"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword } from "@/lib/actions/auth";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Only clear the fields on success — on an error (e.g. current password wrong) the member
  // should be able to see/fix what they typed for the new-password fields rather than retype
  // everything from scratch.
  useEffect(() => {
    if (state && "success" in state && state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="current_password">Current password</Label>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 max-w-sm"
        />
      </div>
      <div>
        <Label htmlFor="new_password">New password</Label>
        <Input
          id="new_password"
          name="new_password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 max-w-sm"
        />
      </div>
      <div>
        <Label htmlFor="confirm_password">Confirm new password</Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 max-w-sm"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Updating..." : "Update password"}
      </Button>
      {state && "success" in state && state.success && (
        <p className="text-sm text-emerald-400">Password updated.</p>
      )}
      {state && "error" in state && state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
