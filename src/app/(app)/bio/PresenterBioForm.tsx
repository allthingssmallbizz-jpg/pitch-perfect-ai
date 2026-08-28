"use client";

import { useActionState, useState } from "react";
import { Sparkles, Save } from "lucide-react";
import type { PresenterBio } from "@/types/database";
import { updatePresenterBio } from "@/lib/actions/presenterBio";
import { composeIHelpStatement } from "@/lib/ai/presenterBio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import DiscoveryAssistDialog, { type AssistTarget } from "@/components/DiscoveryAssistDialog";

const IHELP_FIELD_NAMES = ["presenter_ihelp_audience", "presenter_ihelp_outcome", "presenter_ihelp_mechanism"];

const FIELD_NAMES = [
  ...IHELP_FIELD_NAMES,
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

  // The other fields below are plain uncontrolled inputs (defaultValue + reading el.value on
  // submit/assist) — fine for them since nothing else on the page needs to react to their content
  // as it changes. These three are controlled specifically so the composed sentence preview can
  // update live as the member types, instead of only appearing after a save round-trip.
  const [ihelpAudience, setIhelpAudience] = useState(bio?.presenter_ihelp_audience ?? "");
  const [ihelpOutcome, setIhelpOutcome] = useState(bio?.presenter_ihelp_outcome ?? "");
  const [ihelpMechanism, setIhelpMechanism] = useState(bio?.presenter_ihelp_mechanism ?? "");
  const ihelpStatement = composeIHelpStatement(ihelpAudience, ihelpOutcome, ihelpMechanism);

  function collectOtherAnswers(): Record<string, string> {
    const out: Record<string, string> = {
      presenter_ihelp_audience: ihelpAudience,
      presenter_ihelp_outcome: ihelpOutcome,
      presenter_ihelp_mechanism: ihelpMechanism,
    };
    for (const key of FIELD_NAMES) {
      if (key in out) continue;
      const el = document.getElementById(key) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) out[key] = el.value;
    }
    return out;
  }

  function handleAssistAccept(key: string, text: string) {
    if (key === "presenter_ihelp_audience") return setIhelpAudience(text);
    if (key === "presenter_ihelp_outcome") return setIhelpOutcome(text);
    if (key === "presenter_ihelp_mechanism") return setIhelpMechanism(text);
    const el = document.getElementById(key) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el) el.value = text;
  }

  return (
    <form action={formAction} className="card-elevated space-y-5 rounded-2xl p-8">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
        <Label className="text-base font-semibold">Your &quot;I Help&quot; statement</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The one-line positioning statement every generator can echo — hooks, headlines, and
          intros stay consistent instead of reinventing your audience and promise each time.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="presenter_ihelp_audience" className="text-xs text-muted-foreground">
                I help...
              </Label>
              <AssistButton
                onClick={() =>
                  setAssistTarget({
                    key: "presenter_ihelp_audience",
                    label: "I Help Statement — audience",
                    type: "text",
                    placeholder: "e.g. professionals 45+",
                  })
                }
              />
            </div>
            <Input
              id="presenter_ihelp_audience"
              name="presenter_ihelp_audience"
              value={ihelpAudience}
              onChange={(e) => setIhelpAudience(e.target.value)}
              placeholder="professionals 45+"
              className="mt-1"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="presenter_ihelp_outcome" className="text-xs text-muted-foreground">
                ...achieve...
              </Label>
              <AssistButton
                onClick={() =>
                  setAssistTarget({
                    key: "presenter_ihelp_outcome",
                    label: "I Help Statement — outcome",
                    type: "text",
                    placeholder: "e.g. turn decades of knowledge into a profitable business",
                  })
                }
              />
            </div>
            <Input
              id="presenter_ihelp_outcome"
              name="presenter_ihelp_outcome"
              value={ihelpOutcome}
              onChange={(e) => setIhelpOutcome(e.target.value)}
              placeholder="turn decades of knowledge into a profitable business"
              className="mt-1"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="presenter_ihelp_mechanism" className="text-xs text-muted-foreground">
                ...with...
              </Label>
              <AssistButton
                onClick={() =>
                  setAssistTarget({
                    key: "presenter_ihelp_mechanism",
                    label: "I Help Statement — mechanism",
                    type: "text",
                    placeholder: "e.g. AI-powered webinars",
                  })
                }
              />
            </div>
            <Input
              id="presenter_ihelp_mechanism"
              name="presenter_ihelp_mechanism"
              value={ihelpMechanism}
              onChange={(e) => setIhelpMechanism(e.target.value)}
              placeholder="AI-powered webinars"
              className="mt-1"
            />
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-background/60 p-3 text-sm">
          {ihelpStatement || (
            <span className="text-muted-foreground">
              Fill in all three above to see your full statement here.
            </span>
          )}
        </p>
      </div>

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
