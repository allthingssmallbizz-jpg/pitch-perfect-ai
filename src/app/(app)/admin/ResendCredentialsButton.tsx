"use client";

import { useActionState, useState } from "react";
import { KeyRound, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminResendCredentials } from "@/lib/actions/admin";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded border border-current px-1.5 py-0.5 text-[11px] hover:bg-white/10"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Can't literally "resend" the original password — Supabase never stores or exposes plaintext
// passwords once set — so this generates a brand new one (adminResendCredentials) and emails it,
// which is what a member who lost/never got their welcome email actually needs. The new password
// is always shown here too, same graceful-degradation pattern as MemberInviteForm, in case the
// email itself fails to send (e.g. Resend not configured yet).
export default function ResendCredentialsButton({
  userId,
  email,
  fullName,
}: {
  userId: string;
  email: string;
  fullName: string | null;
}) {
  const [state, action, pending] = useActionState(adminResendCredentials, undefined);

  return (
    <div className="w-full">
      <form
        action={action}
        onSubmit={(e) => {
          if (
            !window.confirm(
              `Reset ${email}'s password and email them a new one? Their current password will stop working.`
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="fullName" value={fullName ?? ""} />
        <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending}>
          <KeyRound className="mr-1 h-3 w-3" />
          {pending ? "Resetting..." : "Resend login"}
        </Button>
      </form>
      {state && "error" in state && state.error && (
        <p className="mt-1 max-w-[220px] text-[11px] text-destructive">{state.error}</p>
      )}
      {state && "success" in state && state.success && (
        <div
          className={`mt-1 max-w-[220px] rounded border px-2 py-1 text-[11px] ${
            state.emailSent ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}
        >
          <p>{state.message}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <code className="rounded bg-black/30 px-1 py-0.5">{state.password}</code>
            <CopyButton text={state.password} />
          </p>
        </div>
      )}
    </div>
  );
}
