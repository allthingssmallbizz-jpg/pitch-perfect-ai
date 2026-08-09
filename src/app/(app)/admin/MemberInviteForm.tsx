"use client";

import { useActionState } from "react";
import { adminInviteMember } from "@/lib/actions/admin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const TIER_PRESETS = ["Member", "Pro", "Premium", "Founding Member"];

export default function MemberInviteForm() {
  const [state, action, pending] = useActionState(adminInviteMember, undefined);

  return (
    <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
        <Label htmlFor="invite-tier" className="text-xs">
          Tier
        </Label>
        <Input
          id="invite-tier"
          name="tier"
          list="invite-tier-presets"
          defaultValue="Member"
          className="mt-1 h-8 text-sm"
        />
        <datalist id="invite-tier-presets">
          {TIER_PRESETS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
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
      <div className="col-span-2 flex flex-wrap items-center gap-3 sm:col-span-3 lg:col-span-6">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending invite..." : "Send invite"}
        </Button>
        {state && "error" in state && state.error && <p className="text-xs text-destructive">{state.error}</p>}
        {state && "success" in state && state.success && (
          <p className="text-xs text-emerald-400">{state.message}</p>
        )}
      </div>
    </form>
  );
}
