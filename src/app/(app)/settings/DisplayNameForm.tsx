"use client";

import { useActionState } from "react";
import { updateDisplayName } from "@/lib/actions/profile";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function DisplayNameForm({ initialName }: { initialName: string }) {
  const [state, formAction, pending] = useActionState(updateDisplayName, undefined);

  return (
    <form action={formAction}>
      <Label htmlFor="full_name">Display name</Label>
      <div className="mt-1 flex items-center gap-2">
        <Input id="full_name" name="full_name" defaultValue={initialName} className="max-w-sm" />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
      {state && "success" in state && state.success && <p className="mt-1.5 text-sm text-emerald-400">Saved.</p>}
      {state && "error" in state && state.error && <p className="mt-1.5 text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
