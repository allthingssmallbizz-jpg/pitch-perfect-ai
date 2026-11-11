"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Sparkles } from "lucide-react";
import { createProjectFromWebinarScore } from "@/lib/actions/webinarScore";
import { Button } from "@/components/ui/button";

function Submit({ rebuild }: { rebuild: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
      {pending ? "Setting up your project…" : rebuild ? "Rebuild it with Pitch Perfect AI" : "Improve it with Pitch Perfect AI"}
    </Button>
  );
}

export default function CreateProjectButton({ scoreId, rebuild }: { scoreId: string; rebuild: boolean }) {
  return (
    <form action={createProjectFromWebinarScore}>
      <input type="hidden" name="scoreId" value={scoreId} />
      <Submit rebuild={rebuild} />
    </form>
  );
}
