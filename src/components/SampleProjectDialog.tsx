"use client";

import { useFormStatus } from "react-dom";
import { TEMPLATES } from "@/lib/templates";
import { createProjectFromTemplate } from "@/lib/actions/projects";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Rocket, Wand2 } from "lucide-react";
import { onboardingKeys, useLocalFlag } from "@/hooks/useLocalFlag";

function CloneButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        "Loading sample…"
      ) : (
        <>
          <Sparkles className="mr-1.5 h-4 w-4" /> Load sample &amp; try it
        </>
      )}
    </Button>
  );
}

// Shown once to brand-new users (zero projects) — a one-click sample project so they see the
// AI produce something in under a minute instead of staring at a blank discovery form first.
export default function SampleProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [, setOffered] = useLocalFlag(onboardingKeys.sampleOffered);

  // The coaching template is the most complete brief — closest to a "hello world" for the app.
  const seed = TEMPLATES.find((t) => t.id === "coach-2k-program") ?? TEMPLATES[0];

  function handleSkip() {
    setOffered(true);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleSkip())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/15">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl">Welcome to Pitch Perfect AI</DialogTitle>
          <DialogDescription className="pt-2 text-center">
            See what the AI can do in under 60 seconds. We&apos;ll load a fully-filled sample
            offer — hit <strong className="text-foreground">Generate</strong> and watch it write
            a complete webinar outline for you.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-1 text-xs uppercase tracking-wider text-primary/80">Sample offer</div>
          <div className="font-semibold">{seed.answers.product}</div>
          <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{seed.answers.core_promise}</div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
          <div className="rounded-lg border border-border/60 bg-card/40 p-2">
            <Wand2 className="mx-auto mb-1 h-4 w-4 text-primary" />
            Full discovery brief
          </div>
          <div className="rounded-lg border border-border/60 bg-card/40 p-2">
            <Sparkles className="mx-auto mb-1 h-4 w-4 text-primary" />9 AI agents
          </div>
          <div className="rounded-lg border border-border/60 bg-card/40 p-2">
            <Rocket className="mx-auto mb-1 h-4 w-4 text-primary" />
            One-click generation
          </div>
        </div>

        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row">
          <Button type="button" variant="ghost" onClick={handleSkip}>
            Start from scratch
          </Button>
          <form action={createProjectFromTemplate} onSubmit={() => setOffered(true)}>
            <input type="hidden" name="templateId" value={seed.id} />
            <CloneButton />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
