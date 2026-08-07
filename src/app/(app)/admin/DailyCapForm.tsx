"use client";

import { useActionState } from "react";
import { setDailyCap } from "@/lib/actions/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function DailyCapForm({ currentCap }: { currentCap: number }) {
  const [state, formAction, pending] = useActionState(setDailyCap, undefined);

  return (
    <form action={formAction} className="mt-3 flex items-center gap-2">
      <span className="text-sm text-muted-foreground">$</span>
      <Input name="daily_spend_cap_usd" type="number" step="0.01" min="0" defaultValue={currentCap} className="w-32" />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving..." : "Update cap"}
      </Button>
      {state && "success" in state && state.success && <span className="text-sm text-emerald-400">Saved.</span>}
      {state && "error" in state && state.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}
