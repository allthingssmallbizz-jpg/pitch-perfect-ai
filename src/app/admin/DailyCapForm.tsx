"use client";

import { useActionState } from "react";
import { setDailyCap } from "@/lib/actions/admin";

export default function DailyCapForm({ currentCap }: { currentCap: number }) {
  const [state, formAction, pending] = useActionState(setDailyCap, undefined);

  return (
    <form action={formAction} className="mt-3 flex items-center gap-2">
      <span className="text-sm text-neutral-500">$</span>
      <input
        name="daily_spend_cap_usd"
        type="number"
        step="0.01"
        min="0"
        defaultValue={currentCap}
        className="w-32 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-neutral-300 px-4 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Update cap"}
      </button>
      {state && "success" in state && state.success && <span className="text-sm text-green-600">Saved.</span>}
      {state && "error" in state && state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
