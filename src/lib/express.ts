// Pitch Perfect Express™ — short-form presentations (10-25 slides, 10-30 minutes) for the selling
// situations that don't call for an 80-slide webinar: a business association lunch, a church or
// group leader, a corporate client, a room of 15 prospects. Same Hook → Story → Offer method,
// adapted to the time slot, the room, and one clear next step. Client-safe: the generate page's
// intake form and the server share these definitions.

import { z } from "zod";

export const EXPRESS_FORMATS = {
  quick: {
    label: "Quick Pitch",
    slides: 10,
    minutes: "8–12",
    minMinutes: 8,
    defaultMinutes: 10,
    bestFor: "Networking events, introductions, brief meetings",
  },
  persuasive: {
    label: "Persuasive Presentation",
    slides: 15,
    minutes: "15–20",
    minMinutes: 15,
    defaultMinutes: 18,
    bestFor: "Group leaders, consultations, sales meetings",
  },
  authority: {
    label: "Authority Presentation",
    slides: 25,
    minutes: "25–35",
    minMinutes: 25,
    defaultMinutes: 30,
    bestFor: "Workshops, speaking engagements, educational sales talks",
  },
} as const;
export type ExpressFormat = keyof typeof EXPRESS_FORMATS;

export const EXPRESS_AUDIENCE_TYPES = {
  one: { label: "One decision-maker", hint: "A meeting with one person who can say yes" },
  small_group: { label: "A small group (2–15)", hint: "A committee, a leadership team, a small class" },
  room: { label: "A room (16+)", hint: "An event, a workshop, a speaking slot" },
} as const;
export type ExpressAudienceType = keyof typeof EXPRESS_AUDIENCE_TYPES;

// Generous limits — answers pre-filled from Discovery or the Bio can be long. The form stops typing
// at these and shows a counter, so a member never hits a confusing error on Generate.
export const EXPRESS_FIELD_LIMITS = {
  setting: 1000,
  audience: 4000,
  problem: 4000,
  goal: 2000,
  offer: 4000,
  proof: 5000,
  aboutYou: 4000,
} as const;
export type ExpressTextField = keyof typeof EXPRESS_FIELD_LIMITS;

export const EXPRESS_FIELD_QUESTIONS: Record<ExpressTextField, string> = {
  setting: "Where are you presenting, and to whom?",
  audience: "Who will be in the room, and what matters to them?",
  problem: "What problem or opportunity will make them pay attention?",
  goal: "What do you want them to do at the end?",
  offer: "What are you inviting them to consider?",
  proof: "What proof do you have?",
  aboutYou: "Tell us about you, in your own words",
};

const field = (key: ExpressTextField) =>
  z
    .string()
    .trim()
    .max(
      EXPRESS_FIELD_LIMITS[key],
      `“${EXPRESS_FIELD_QUESTIONS[key]}” is too long — please keep it under ${EXPRESS_FIELD_LIMITS[key].toLocaleString()} characters.`
    );

export const expressBriefSchema = z.object({
  format: z.enum(["quick", "persuasive", "authority"]).default("persuasive"),
  minutes: z.number().int().min(3).max(120).nullable().default(null),
  setting: field("setting").min(3, "Say where you're presenting and to whom."),
  audienceType: z.enum(["one", "small_group", "room"]).default("small_group"),
  audience: field("audience").min(3, "Describe who will be in the room."),
  problem: field("problem").min(3, "Describe the problem or opportunity that will make them pay attention."),
  goal: field("goal").min(3, "Say what you want them to do at the end."),
  offer: field("offer").min(3, "Describe what you're inviting them to consider."),
  proof: field("proof").default(""),
  aboutYou: field("aboutYou").min(3, "Tell us a little about yourself."),
});

// Pre-filled answers are cut to fit, so a long Discovery answer never blocks Generate.
export function fitExpressBrief(brief: ExpressBrief): ExpressBrief {
  const next = { ...brief };
  for (const key of Object.keys(EXPRESS_FIELD_LIMITS) as ExpressTextField[]) {
    next[key] = (next[key] ?? "").slice(0, EXPRESS_FIELD_LIMITS[key]);
  }
  return next;
}
export type ExpressBrief = z.infer<typeof expressBriefSchema>;

export function emptyExpressBrief(): ExpressBrief {
  return {
    format: "persuasive",
    minutes: null,
    setting: "",
    audienceType: "small_group",
    audience: "",
    problem: "",
    goal: "",
    offer: "",
    proof: "",
    aboutYou: "",
  };
}

// A short time slot gets fewer slides than the format's starting point — roughly one per minute,
// never fewer than six.
export function expressSlideTarget(brief: Pick<ExpressBrief, "format" | "minutes">): number {
  const f = EXPRESS_FORMATS[brief.format];
  if (brief.minutes && brief.minutes < f.minMinutes) return Math.max(6, Math.round(brief.minutes));
  return f.slides;
}

export function expressMinutes(brief: Pick<ExpressBrief, "format" | "minutes">): number {
  return brief.minutes ?? EXPRESS_FORMATS[brief.format].defaultMinutes;
}

// A relaxed, conversational speaking pace.
export const SPEAKING_WORDS_PER_MINUTE = 130;

// Estimated delivery time from what the presenter actually says (titles + speaker notes).
export function estimateSpeakingMinutes(slides: { title: string; notes: string }[]): number {
  const words = slides.reduce((sum, s) => sum + `${s.title} ${s.notes}`.split(/\s+/).filter(Boolean).length, 0);
  return Math.max(1, Math.round(words / SPEAKING_WORDS_PER_MINUTE));
}

export function parseStoredExpressBrief(raw: string | null | undefined): ExpressBrief | null {
  if (!raw) return null;
  try {
    const parsed = expressBriefSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
