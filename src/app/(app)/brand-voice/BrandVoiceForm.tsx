"use client";

import { useActionState } from "react";
import { updateBrandVoice } from "@/lib/actions/brandVoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import type { BrandVoice } from "@/types/database";

export default function BrandVoiceForm({ brandVoice }: { brandVoice: BrandVoice | null }) {
  const [state, formAction, pending] = useActionState(updateBrandVoice, undefined);

  return (
    <form action={formAction} className="card-elevated space-y-6 rounded-2xl p-8">
      <div>
        <Label htmlFor="tone">Tone & voice description</Label>
        <Textarea
          id="tone"
          name="tone"
          rows={3}
          defaultValue={brandVoice?.tone ?? ""}
          placeholder="e.g. Warm and direct, no fluff, quietly confident. Sound like a smart friend who's done this 100 times, not a marketer."
          className="mt-1"
        />
        <p className="mt-1 text-xs text-muted-foreground">How the copy should feel — personality, energy, formality.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="preferred_words">Preferred words / phrases</Label>
          <Input
            id="preferred_words"
            name="preferred_words"
            defaultValue={brandVoice?.preferred_words ?? ""}
            placeholder="e.g. actually, simple, real, honestly"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">Words that sound like you.</p>
        </div>
        <div>
          <Label htmlFor="forbidden_words">Forbidden words</Label>
          <Input
            id="forbidden_words"
            name="forbidden_words"
            defaultValue={brandVoice?.forbidden_words ?? ""}
            placeholder="e.g. leverage, synergy, unlock, game-changing"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">Never appear in output.</p>
        </div>
      </div>

      <div>
        <Label htmlFor="sample_writing">Sample of your own writing</Label>
        <Textarea
          id="sample_writing"
          name="sample_writing"
          rows={10}
          defaultValue={brandVoice?.sample_writing ?? ""}
          placeholder="Paste 200-800 words of writing that sounds exactly how you want your copy to sound — an email you sent, a LinkedIn post, a page from your book. The AI will mirror the rhythm and vocabulary."
          className="mt-1"
        />
        <p className="mt-1 text-xs text-muted-foreground">The single highest-leverage input. Paste real writing.</p>
      </div>

      <div>
        <Label htmlFor="extra_notes">Extra voice notes (optional)</Label>
        <Textarea
          id="extra_notes"
          name="extra_notes"
          rows={3}
          defaultValue={brandVoice?.extra_notes ?? ""}
          placeholder="e.g. Always end emails with 'Talk soon,'. Never use exclamation points."
          className="mt-1"
        />
      </div>

      <div className="flex items-center justify-between">
        <Button type="submit" disabled={pending}>
          <Save className="mr-2 h-4 w-4" />
          {pending ? "Saving…" : "Save brand voice"}
        </Button>
        {state && "success" in state && state.success && (
          <span className="text-sm text-emerald-400">Saved — every future generation will match this.</span>
        )}
        {state && "error" in state && state.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}
