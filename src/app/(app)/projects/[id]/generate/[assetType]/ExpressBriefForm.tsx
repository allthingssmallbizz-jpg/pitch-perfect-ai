"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPRESS_AUDIENCE_TYPES,
  EXPRESS_FIELD_LIMITS,
  EXPRESS_FORMATS,
  expressSlideTarget,
  type ExpressAudienceType,
  type ExpressBrief,
  type ExpressFormat,
} from "@/lib/express";

// The Pitch Perfect Express™ intake: a handful of conversational questions about THIS occasion —
// not the full webinar Discovery brief. Pre-filled from the last Express presentation, or from
// Discovery and the Bio, so a member only answers what's actually new.
export const EXPRESS_REQUIRED: { key: keyof ExpressBrief; label: string }[] = [
  { key: "setting", label: "where you're presenting" },
  { key: "audience", label: "who will be in the room" },
  { key: "problem", label: "their problem or opportunity" },
  { key: "goal", label: "what you want them to do" },
  { key: "offer", label: "what you're inviting them to consider" },
  { key: "aboutYou", label: "about you" },
];

export function missingExpressFields(brief: ExpressBrief): string[] {
  return EXPRESS_REQUIRED.filter(({ key }) => String(brief[key] ?? "").trim().length < 3).map((f) => f.label);
}

// Shows a count once an answer gets near its limit; the box itself stops at the limit.
function LengthNote({ value, max }: { value: string; max: number }) {
  if (value.length < max * 0.8) return null;
  return (
    <p className={`mt-0.5 text-right text-[11px] ${value.length >= max ? "text-amber-400" : "text-muted-foreground"}`}>
      {value.length.toLocaleString()} / {max.toLocaleString()} characters
    </p>
  );
}

function Question({
  label,
  hint,
  value,
  onChange,
  placeholder,
  max,
  rows = 2,
  optional = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max: number;
  rows?: number;
  optional?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium">
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> (optional)</span> : <span className="text-primary"> *</span>}
      </label>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        maxLength={max}
        placeholder={placeholder}
        rows={rows}
        className="mt-1 text-sm"
      />
      <LengthNote value={value} max={max} />
    </div>
  );
}

export default function ExpressBriefForm({
  brief,
  onChange,
  disabled = false,
}: {
  brief: ExpressBrief;
  onChange: (next: ExpressBrief) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof ExpressBrief>(key: K, value: ExpressBrief[K]) => onChange({ ...brief, [key]: value });
  const slides = expressSlideTarget(brief);

  return (
    <fieldset disabled={disabled} className="card-elevated mb-4 space-y-5 rounded-2xl p-5">
      <div>
        <p className="font-display text-base font-semibold">What kind of presentation is this?</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(Object.keys(EXPRESS_FORMATS) as ExpressFormat[]).map((key) => {
            const f = EXPRESS_FORMATS[key];
            const active = brief.format === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => set("format", key)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  active ? "border-primary bg-primary/10" : "border-border bg-card/40 hover:border-primary/50"
                }`}
              >
                <span className="block text-sm font-semibold">{f.label}</span>
                <span className="block text-xs text-primary">
                  {f.slides} slides · {f.minutes} min
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{f.bestFor}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="express-minutes" className="text-muted-foreground">
            How many minutes will you actually have?
          </label>
          <Input
            id="express-minutes"
            type="number"
            min={3}
            max={120}
            value={brief.minutes ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              set("minutes", e.target.value && Number.isFinite(n) ? Math.min(120, Math.max(3, Math.round(n))) : null);
            }}
            placeholder={String(EXPRESS_FORMATS[brief.format].defaultMinutes)}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground">
            → {slides} slides{brief.minutes && slides < EXPRESS_FORMATS[brief.format].slides ? " (trimmed to fit your time)" : ""}
          </span>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">
          Who will you be presenting to? <span className="text-primary">*</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(EXPRESS_AUDIENCE_TYPES) as ExpressAudienceType[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => set("audienceType", key)}
              title={EXPRESS_AUDIENCE_TYPES[key].hint}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                brief.audienceType === key ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {EXPRESS_AUDIENCE_TYPES[key].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="express-setting">
          Where are you presenting, and to whom? <span className="text-primary">*</span>
        </label>
        <Input
          id="express-setting"
          value={brief.setting}
          onChange={(e) => set("setting", e.target.value.slice(0, EXPRESS_FIELD_LIMITS.setting))}
          maxLength={EXPRESS_FIELD_LIMITS.setting}
          placeholder="e.g. Women's ministry leaders at First Baptist Church · Chamber of Commerce lunch · A meeting with the HR director at Acme"
          className="mt-1"
        />
        <LengthNote value={brief.setting} max={EXPRESS_FIELD_LIMITS.setting} />
      </div>

      <Question
        label="Who will be in the room, and what matters to them?"
        value={brief.audience}
        onChange={(v) => set("audience", v)}
        max={EXPRESS_FIELD_LIMITS.audience}
        placeholder="e.g. Church organizers who plan trips for 20-60 members. They care about everyone having a great time and not getting stuck doing all the work."
      />
      <Question
        label="What problem or opportunity will make them pay attention?"
        value={brief.problem}
        onChange={(v) => set("problem", v)}
        max={EXPRESS_FIELD_LIMITS.problem}
        placeholder="e.g. Coordinating travel for a big group is stressful — payments, rooms, schedules, and last-minute changes."
      />
      <Question
        label="What do you want them to do at the end?"
        hint="Book a call, schedule a meeting, request an offer, sign up, approve a proposal…"
        value={brief.goal}
        onChange={(v) => set("goal", v)}
        max={EXPRESS_FIELD_LIMITS.goal}
        placeholder="e.g. Agree to explore a group trip and pick a date for a planning call."
      />
      <Question
        label="What are you inviting them to consider?"
        hint="Your service or offer, and the price or terms if you'll mention them."
        value={brief.offer}
        onChange={(v) => set("offer", v)}
        max={EXPRESS_FIELD_LIMITS.offer}
        rows={3}
        placeholder="e.g. I plan and coordinate the whole trip — booking, payments, rooming lists, and day-of support. No cost to the organizer."
      />
      <Question
        label="What proof do you have?"
        hint="Results, client stories, testimonials, experience. Leave it blank if you don't have any yet — we'll build credibility from your experience and process, never invented results."
        value={brief.proof}
        onChange={(v) => set("proof", v)}
        max={EXPRESS_FIELD_LIMITS.proof}
        rows={2}
        optional
      />
      <Question
        label="Tell us about you, in your own words"
        hint="Who you are, what you do, how long you've done it, and why you care about this audience. Don't polish it — we'll turn it into your introduction."
        value={brief.aboutYou}
        onChange={(v) => set("aboutYou", v)}
        max={EXPRESS_FIELD_LIMITS.aboutYou}
        rows={3}
        placeholder="e.g. I've planned group trips for 12 years. I started after organizing my own church's first cruise and loved seeing everyone so happy."
      />
    </fieldset>
  );
}
