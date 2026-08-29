"use client";

import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { adminSetPassword } from "@/lib/actions/admin";

// Companion to ResendCredentialsButton's auto-generated password — this is the manual-handoff
// path for when an admin would rather choose the member's password themselves (e.g. to say it out
// loud, text it, or use one the member already picked) than read a random string off the screen.
// No email is sent here; the member can log in with it the instant this succeeds.
export default function SetPasswordForm({ userId, email }: { userId: string; email: string }) {
  const [state, action, pending] = useActionState(adminSetPassword, undefined);
  const [password, setPassword] = useState("");

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Set a new password for ${email}? Their current password will stop working.`)) {
          e.preventDefault();
        }
      }}
      className="mt-1.5 flex flex-col gap-1"
    >
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-center gap-1">
        <PasswordInput
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          minLength={8}
          className="h-7 w-32 px-2 text-xs"
        />
        <Button type="submit" size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" disabled={pending}>
          <KeyRound className="mr-1 h-3 w-3" />
          {pending ? "Saving..." : "Update password"}
        </Button>
      </div>
      {state && "error" in state && state.error && <p className="text-[11px] text-destructive">{state.error}</p>}
      {state && "success" in state && state.success && (
        <p className="text-[11px] text-emerald-400">Password updated — they can log in with it now.</p>
      )}
    </form>
  );
}
