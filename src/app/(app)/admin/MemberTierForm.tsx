"use client";

import { useActionState } from "react";
import { adminSetTier } from "@/lib/actions/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const TIER_PRESETS = ["Member", "Pro", "Premium", "Founding Member"];

export default function MemberTierForm({ userId, currentTier }: { userId: string; currentTier: string }) {
  const [state, action, pending] = useActionState(adminSetTier, undefined);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-center gap-1.5">
        <Input
          name="tier"
          list={`tier-presets-${userId}`}
          defaultValue={currentTier}
          className="h-7 w-32 px-2 text-xs"
        />
        <datalist id={`tier-presets-${userId}`}>
          {TIER_PRESETS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending}>
          {pending ? "..." : "Save"}
        </Button>
      </div>
      {state && "error" in state && state.error && <p className="text-[11px] text-destructive">{state.error}</p>}
    </form>
  );
}
