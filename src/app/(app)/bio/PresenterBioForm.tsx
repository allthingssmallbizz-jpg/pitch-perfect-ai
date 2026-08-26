"use client";

import { useActionState, useState } from "react";
import { Sparkles, Save } from "lucide-react";
import type { PresenterBio } from "@/types/database";
import { updatePresenterBio } from "@/lib/actions/presenterBio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import DiscoveryAssistDialog, { type AssistTarget } from "@/components/DiscoveryAssistDialog";

const FIELD_NAMES = [
  "presenter_mission",
  "presenter_years_experience",
  "presenter_credentials",
  "presenter_origin_story",
  "presenter_signature_win",
  "presenter_setback_story",
  "presenter_income_goal_6mo",
  "presenter_income_goal_12mo",
  "presenter_mission_why",
  "presenter_recognition",
  "presenter_relatable_detail",
];

function AssistButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      <Sparkles className="h-3 w-3" />
      AI Assist
    </button>
  );
}

function Field({
  label,
  name,
  defaultValue,
  textarea = true,
  placeholder,
  hint,
  onAssist,
}: {
  label: string;
  name: string;
  defaultValue: string;
  textarea?: boolean;
  placeholder?: string;
  hint?: string;
  onAssist: (target: AssistTarget) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={name}>{label}</Label>
        <AssistButton
          onClick={() => onAssist({ key: name, label, type: textarea ? "textarea" : "text", placeholder })}
        />
      </div>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      {textarea ? (
        <Textarea id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} rows={2} className="mt-1" />
      ) : (
        <Input id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} className="mt-1" />
      )}
    </div>
  );
}

export default function PresenterBioForm({ bio }: { bio: PresenterBio | null }) {
  const [state, formAction, pending] = useActionState(updatePresenterBio, undefined);
  const [assistTarget, setAssistTarget] = useState<AssistTarget | null>(null);

  function collectOtherAnswers(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of FIELD_NAMES) {
      const el = document.getElementById(key) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) out[key] = el.value;
    }
    return out;
  }

  function handleAssistAccept(key: string, text: string) {
    const el = document.getElementById(key) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el) el.value = text;
  }

  return (
    <form action={formAction} className="card-elevated space-y-5 rounded-2xl p-8">
      <Field
        label="What do you help people do?"
        name="presenter_mission"
        defaultValue={bio?.presenter_mission ?? ""}
        placeholder="In one or two sentences — your core mission."
        hint="If a stranger asked 'what do you do,' what's the one-line answer you'd actually give?"
        onAssist={setAssistTarget}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Years in this industry"
          name="presenter_years_experience"
          defaultValue={bio?.presenter_years_experience ?? ""}
          textarea={false}
          placeholder="e.g. 12 years"
          onAssist={setAssistTarget}
        />
        <Field
          label="Credentials, certifications, or degrees"
          name="presenter_credentials"
          defaultValue={bio?.presenter_credentials ?? ""}
          textarea={false}
          placeholder="Any that are relevant — or 'none, results-based' if that's the truth."
          onAssist={setAssistTarget}
        />
      </div>
      <Field
        label="How did you get into this industry?"
        name="presenter_origin_story"
        defaultValue={bio?.presenter_origin_story ?? ""}
        placeholder="Your origin story — what led you here?"
        hint="This is often the single most relatable thing in a whole presentation — don't polish it too much."
        onAssist={setAssistTarget}
      />
      <Field
        label="Your greatest client transformation"
        name="presenter_signature_win"
        defaultValue={bio?.presenter_signature_win ?? ""}
        placeholder="The single biggest impact you've had on a client — a specific result."
        hint="Pick ONE story, not a list — specific beats impressive. What did their life look like before, and after?"
        onAssist={setAssistTarget}
      />
      <Field
        label="A major setback — and how you turned it around"
        name="presenter_setback_story"
        defaultValue={bio?.presenter_setback_story ?? ""}
        placeholder="Struggled, failed, or hit a wall trying to build this? Tell it honestly."
        hint="A real setback, told honestly, builds more trust than a highlight reel — it's exactly what makes an Opening Story land."
        onAssist={setAssistTarget}
      />
      <Field
        label="Your personal 'why'"
        name="presenter_mission_why"
        defaultValue={bio?.presenter_mission_why ?? ""}
        placeholder="Why does this matter to YOU, personally — beyond the business?"
        hint="This is what makes an audience trust you're in it for more than the sale."
        onAssist={setAssistTarget}
      />
      <Field
        label="Media, speaking, or industry recognition"
        name="presenter_recognition"
        defaultValue={bio?.presenter_recognition ?? ""}
        placeholder="Podcasts, press, stages you've spoken on, awards — leave blank if none yet."
        onAssist={setAssistTarget}
      />
      <Field
        label="A relatable, human detail about you"
        name="presenter_relatable_detail"
        defaultValue={bio?.presenter_relatable_detail ?? ""}
        placeholder="A hobby, your family, something ordinary about you."
        hint="Often what makes a stranger start to like and trust you, not just respect you."
        onAssist={setAssistTarget}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Income goal — next 6 months"
          name="presenter_income_goal_6mo"
          defaultValue={bio?.presenter_income_goal_6mo ?? ""}
          textarea={false}
          placeholder="e.g. $20k/month"
          onAssist={setAssistTarget}
        />
        <Field
          label="Income goal — next 12 months"
          name="presenter_income_goal_12mo"
          defaultValue={bio?.presenter_income_goal_12mo ?? ""}
          textarea={false}
          placeholder="e.g. $50k/month"
          onAssist={setAssistTarget}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Income goals are context for you, not customer-facing copy — generators only use them for
        authentic vision-casting where it genuinely fits, never as a line to quote.
      </p>

      <div className="flex items-center justify-between border-t border-border pt-5">
        <Button type="submit" disabled={pending}>
          <Save className="mr-2 h-4 w-4" />
          {pending ? "Saving…" : "Save bio"}
        </Button>
        {state && "success" in state && state.success && (
          <span className="text-sm text-emerald-400">Saved — every project can use this now.</span>
        )}
        {state && "error" in state && state.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>

      <DiscoveryAssistDialog
        target={assistTarget}
        onOpenChange={(open) => !open && setAssistTarget(null)}
        otherAnswers={collectOtherAnswers}
        onAccept={handleAssistAccept}
      />
    </form>
  );
}
