"use client";

import { useActionState } from "react";
import { adminSetCredits, adminAddCredits } from "@/lib/actions/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function MemberCreditsForm({ userId, currentBalance }: { userId: string; currentBalance: number }) {
  const [setState, setAction, setPending] = useActionState(adminSetCredits, undefined);
  const [addState, addAction, addPending] = useActionState(adminAddCredits, undefined);

  return (
    <div className="flex flex-col gap-1.5">
      <form action={setAction} className="flex items-center gap-1.5">
        <input type="hidden" name="userId" value={userId} />
        <span className="text-xs text-muted-foreground">Set</span>
        <Input name="credits" type="number" min="0" step="1" defaultValue={currentBalance} className="h-7 w-20 px-2 text-xs" />
        <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={setPending}>
          {setPending ? "..." : "Save"}
        </Button>
      </form>
      <form action={addAction} className="flex items-center gap-1.5">
        <input type="hidden" name="userId" value={userId} />
        <span className="text-xs text-muted-foreground">Add</span>
        <Input name="credits" type="number" step="1" placeholder="±50" className="h-7 w-20 px-2 text-xs" />
        <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={addPending}>
          {addPending ? "..." : "Add"}
        </Button>
      </form>
      {(setState && "error" in setState && setState.error) && (
        <p className="text-[11px] text-destructive">{setState.error}</p>
      )}
      {(addState && "error" in addState && addState.error) && (
        <p className="text-[11px] text-destructive">{addState.error}</p>
      )}
    </div>
  );
}
