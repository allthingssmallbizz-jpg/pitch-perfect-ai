"use client";

import { useActionState } from "react";
import type { Tier } from "@/types/database";
import { adminSetTier } from "@/lib/actions/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const TIERS: Tier[] = ["Gold", "Silver", "Platinum", "Founding Member"];

export default function MemberTierForm({
  userId,
  currentTier,
  currentBonusNicheLimit,
}: {
  userId: string;
  currentTier: Tier;
  currentBonusNicheLimit: number;
}) {
  const [state, action, pending] = useActionState(adminSetTier, undefined);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-center gap-1.5">
        <select
          name="tier"
          defaultValue={currentTier}
          className="h-7 rounded-md border border-input bg-background px-2 text-xs"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Input
          name="bonusNicheLimit"
          type="number"
          min={0}
          defaultValue={currentBonusNicheLimit}
          title="Bonus niches — extra account/webinar niches on top of the tier's normal limit"
          className="h-7 w-14 px-2 text-xs"
        />
        <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending}>
          {pending ? "..." : "Save"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Tier + bonus niches (extra account/webinar creations)</p>
      {state && "error" in state && state.error && <p className="text-[11px] text-destructive">{state.error}</p>}
    </form>
  );
}
