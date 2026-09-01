"use client";

import { useActionState, useState } from "react";
import { Copy, Check } from "lucide-react";
import { adminInviteMember } from "@/lib/actions/admin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const TIERS = ["Gold", "Silver", "Platinum", "Founding Member"];

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
      className="inline-flex items-center gap-1 rounded border border-emerald-500/40 px-1.5 py-0.5 text-[11px] text-emerald-300 hover:bg-emerald-500/10"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function MemberInviteForm() {
  const [state, action, pending] = useActionState(adminInviteMember, undefined);

  return (
    <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      <div className="col-span-2 sm:col-span-1">
        <Label htmlFor="invite-email" className="text-xs">
          Email
        </Label>
        <Input id="invite-email" name="email" type="email" required className="mt-1 h-8 text-sm" />
      </div>
      <div>
        <Label htmlFor="invite-name" className="text-xs">
          Name (optional)
        </Label>
        <Input id="invite-name" name="full_name" className="mt-1 h-8 text-sm" />
      </div>
      <div>
        <Label htmlFor="invite-password" className="text-xs">
          Password (optional)
        </Label>
        <Input
          id="invite-password"
          name="password"
          placeholder="Leave blank to auto-generate"
          className="mt-1 h-8 text-sm"
        />
      </div>
      <div>
        <Label htmlFor="invite-tier" className="text-xs">
          Tier
        </Label>
        <select
          id="invite-tier"
          name="tier"
          defaultValue="Gold"
          className="mt-1 h-8 w-full rounded-md border border-input bg-input/30 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="invite-role" className="text-xs">
          Role
        </Label>
        <select
          id="invite-role"
          name="role"
          defaultValue="member"
          className="mt-1 h-8 w-full rounded-md border border-input bg-input/30 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div>
        <Label htmlFor="invite-credits" className="text-xs">
          Starting credits
        </Label>
        <Input
          id="invite-credits"
          name="credits"
          type="number"
          min="0"
          step="1"
          defaultValue={200}
          className="mt-1 h-8 text-sm"
        />
      </div>
      <div>
        <Label htmlFor="invite-months" className="text-xs">
          Access (months)
        </Label>
        <Input
          id="invite-months"
          name="access_months"
          type="number"
          min="1"
          step="1"
          defaultValue={12}
          className="mt-1 h-8 text-sm"
        />
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-3 sm:col-span-3 lg:col-span-7">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creating account..." : "Create account"}
        </Button>
        {state && "error" in state && state.error && <p className="text-xs text-destructive">{state.error}</p>}
      </div>
      {state && "success" in state && state.success && (
        <div
          className={`col-span-2 rounded-lg border px-3 py-2 text-xs sm:col-span-3 lg:col-span-7 ${
            state.emailSent
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-amber-500/30 bg-amber-500/10"
          }`}
        >
          <p className={state.emailSent ? "text-emerald-300" : "text-amber-300"}>{state.message}</p>
          <p className={`mt-1 flex flex-wrap items-center gap-2 ${state.emailSent ? "text-emerald-400" : "text-amber-400"}`}>
            Password: <code className="rounded bg-black/30 px-1.5 py-0.5">{state.password}</code>
            <CopyButton text={state.password} />
          </p>
          <p className="mt-1 text-muted-foreground">
            {state.emailSent
              ? "They've been emailed their login details and can sign in right away."
              : "Shown once — copy it now and send it to the member yourself (text, email, in person). They can log in immediately with their email and this password."}
          </p>
        </div>
      )}
    </form>
  );
}
