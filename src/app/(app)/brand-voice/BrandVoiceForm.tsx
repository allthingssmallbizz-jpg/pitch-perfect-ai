"use client";

import { useActionState, useState } from "react";
import { updateBrandVoice } from "@/lib/actions/brandVoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import type { BrandVoice } from "@/types/database";

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// Native color picker + a hex text field kept in sync — lets someone pick visually, or paste
// an exact hex code straight from their existing brand guidelines, whichever they have on hand.
function ColorField({
  name,
  label,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder: string;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const swatchValue = HEX_COLOR_PATTERN.test(value) ? value : "#888888";

  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={swatchValue}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
        />
        <Input
          id={name}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
      </div>
    </div>
  );
}

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

      <div className="border-t border-border pt-6">
        <h2 className="mb-1 text-sm font-semibold">Brand color palette (optional)</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Set up to 4 brand colors and the Landing Page generator uses this exact palette instead
          of picking its own — it decides which color works best for buttons, backgrounds,
          borders/outlines, and small accents, so the page gets real visual range instead of just
          two colors repeated everywhere. Leave any of these blank if you don&apos;t have one.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <ColorField
            name="primary_color"
            label="Primary color"
            placeholder="#3366FF"
            defaultValue={brandVoice?.primary_color ?? ""}
          />
          <ColorField
            name="secondary_color"
            label="Secondary color"
            placeholder="#111827"
            defaultValue={brandVoice?.secondary_color ?? ""}
          />
          <ColorField
            name="accent_color"
            label="Accent color"
            placeholder="#F59E0B"
            defaultValue={brandVoice?.accent_color ?? ""}
          />
          <ColorField
            name="outline_color"
            label="Outline / border color"
            placeholder="#E5E7EB"
            defaultValue={brandVoice?.outline_color ?? ""}
          />
        </div>
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
