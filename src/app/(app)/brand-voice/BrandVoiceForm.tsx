"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { updateBrandVoice } from "@/lib/actions/brandVoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandVoice } from "@/types/database";
import { BRAND_COLOR_STYLES, BRAND_COLOR_SURPRISE_CREDIT_COST, type BrandColorPalette } from "@/lib/ai/brandColorPalette";

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// Native color picker + a hex text field kept in sync — lets someone pick visually, or paste
// an exact hex code straight from their existing brand guidelines, whichever they have on hand.
// Controlled from the parent (rather than owning its own state) so "Surprise me" can push a
// whole AI-suggested palette into all four fields at once.
function ColorField({
  name,
  label,
  placeholder,
  value,
  onChange,
}: {
  name: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const swatchValue = HEX_COLOR_PATTERN.test(value) ? value : "#888888";

  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={swatchValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
        />
        <Input
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
      </div>
    </div>
  );
}

export default function BrandVoiceForm({ brandVoice }: { brandVoice: BrandVoice | null }) {
  const [state, formAction, pending] = useActionState(updateBrandVoice, undefined);

  const [primaryColor, setPrimaryColor] = useState(brandVoice?.primary_color ?? "");
  const [secondaryColor, setSecondaryColor] = useState(brandVoice?.secondary_color ?? "");
  const [accentColor, setAccentColor] = useState(brandVoice?.accent_color ?? "");
  const [outlineColor, setOutlineColor] = useState(brandVoice?.outline_color ?? "");

  const [selectedStyle, setSelectedStyle] = useState<string>(BRAND_COLOR_STYLES[0].id);
  const [surprising, setSurprising] = useState(false);

  function applyPalette(palette: BrandColorPalette) {
    setPrimaryColor(palette.primary_color);
    setSecondaryColor(palette.secondary_color);
    setAccentColor(palette.accent_color);
    setOutlineColor(palette.outline_color);
  }

  async function surpriseMe() {
    setSurprising(true);
    try {
      const res = await fetch("/api/brand-voice/surprise-colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: selectedStyle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate a palette.");
      applyPalette(data.palette);
      toast.success("New palette ready to review below — hit Save to keep it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate a palette.");
    } finally {
      setSurprising(false);
    }
  }

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

        <div className="mb-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
          <p className="mb-2 text-xs font-medium text-foreground">
            Don&apos;t have brand colors yet? Pick a style and let the AI suggest a palette.
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {BRAND_COLOR_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStyle(s.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  selectedStyle === s.id
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={surpriseMe} disabled={surprising}>
            {surprising ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {surprising ? "Thinking..." : "Surprise me"}
          </Button>
          <span className="ml-2 text-[11px] text-muted-foreground">{BRAND_COLOR_SURPRISE_CREDIT_COST} credit</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ColorField
            name="primary_color"
            label="Primary color"
            placeholder="#3366FF"
            value={primaryColor}
            onChange={setPrimaryColor}
          />
          <ColorField
            name="secondary_color"
            label="Secondary color"
            placeholder="#111827"
            value={secondaryColor}
            onChange={setSecondaryColor}
          />
          <ColorField
            name="accent_color"
            label="Accent color"
            placeholder="#F59E0B"
            value={accentColor}
            onChange={setAccentColor}
          />
          <ColorField
            name="outline_color"
            label="Outline / border color"
            placeholder="#E5E7EB"
            value={outlineColor}
            onChange={setOutlineColor}
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
