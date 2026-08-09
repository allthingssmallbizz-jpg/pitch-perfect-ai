"use client";

import { useActionState } from "react";
import { setDiscoveryVideoUrl } from "@/lib/actions/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function DiscoveryVideoForm({ currentUrl }: { currentUrl: string | null }) {
  const [state, formAction, pending] = useActionState(setDiscoveryVideoUrl, undefined);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <Input
        name="discovery_video_url"
        placeholder="https://www.youtube.com/watch?v=..."
        defaultValue={currentUrl ?? ""}
        className="max-w-sm"
      />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
      {state && "success" in state && state.success && <span className="text-sm text-emerald-400">Saved.</span>}
      {state && "error" in state && state.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}
