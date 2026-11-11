// Webinar Score: an existing webinar (uploaded .pptx or pasted script/transcript/outline) scored
// out of 100 against the same framework every Pitch Perfect deck is built on (see
// lib/ai/generators/pptOutline.ts). Pure and client-safe — the result page reads these too.

import { z } from "zod";

// Weights mirror where the framework does its real work: the belief shifts (Big Domino + Three
// Secrets) carry the most, then the opening, origin story, proof, and value stack.
export const WEBINAR_SCORE_CATEGORIES = [
  {
    key: "opening_promise",
    label: "Opening & Big Promise",
    max: 10,
    looksFor:
      "A clear webinar title/topic, who it's for, the Big Promise stated early, a reason to stay to the end, and a light agenda.",
  },
  {
    key: "presenter_connection",
    label: "Meet the Presenter",
    max: 5,
    looksFor:
      "The presenter introduced early as a real, relatable person (family, personal why) before the teaching starts — not a résumé.",
  },
  {
    key: "origin_story",
    label: "Origin Story (Epiphany Bridge™)",
    max: 10,
    looksFor:
      "The presenter's backstory: the struggle or wall they hit, the epiphany, and the new way they discovered — told as a story, not claims.",
  },
  {
    key: "three_secrets",
    label: "Big Domino & Three Secrets™",
    max: 20,
    looksFor:
      "The ONE big belief that makes everything else fall (Big Domino), then three false beliefs broken in turn — about the vehicle, about themselves (internal), and about outside obstacles (external) — each with its own story or proof.",
  },
  {
    key: "proof",
    label: "Proof & Credibility",
    max: 10,
    looksFor: "Real results, case studies, and testimonials, each answering a different objection.",
  },
  {
    key: "offer_transition",
    label: "Offer Transition & Future Pacing",
    max: 5,
    looksFor:
      "A smooth pivot to the offer as the logical next step, and future pacing (helping them picture life 30/90/365 days after joining).",
  },
  {
    key: "value_stack",
    label: "Value Stack",
    max: 10,
    looksFor:
      "The core offer presented first with its value, then each component and bonus introduced one at a time with its own value, with recaps and a final total — never one slide dumping everything.",
  },
  {
    key: "value_question",
    label: "Value Justification Question",
    max: 5,
    looksFor:
      "Right before the price: \"Although I'm not going to charge you [total value] today, if I were to charge you that, would it be worth it?\" (or a close equivalent).",
  },
  {
    key: "price_reveal",
    label: "Price Reveal",
    max: 5,
    looksFor:
      "The price revealed alone, contrasted with the total value, with no price talk (price rises, future price, payment plans) before it.",
  },
  {
    key: "guarantee",
    label: "Guarantee & Risk Reversal",
    max: 5,
    looksFor: "A clear guarantee or risk reversal presented after the price.",
  },
  {
    key: "urgency",
    label: "Genuine Urgency & Fast Action Bonuses",
    max: 5,
    looksFor:
      "Real, honest reasons to act now — deadlines, limited spots, fast action bonuses with clear conditions — without fake scarcity.",
  },
  {
    key: "close_cta",
    label: "Two Paths & Call to Action",
    max: 5,
    looksFor:
      "A Two Paths close (do it alone vs. with help), one clear call to action repeated, and objections handled (Q&A or FAQ).",
  },
  {
    key: "craft",
    label: "Slide Clarity",
    max: 5,
    looksFor:
      "Slide titles that state the real point (not framework labels like \"Case Study\" or \"Stack Item\"), one idea per slide, and easy-to-read slides.",
  },
] as const;

export type WebinarScoreCategoryKey = (typeof WEBINAR_SCORE_CATEGORIES)[number]["key"];
const CATEGORY_KEYS = WEBINAR_SCORE_CATEGORIES.map((c) => c.key) as [WebinarScoreCategoryKey, ...WebinarScoreCategoryKey[]];

const text = (description: string) => z.string().describe(description);

export const webinarScoreAnalysisSchema = z.object({
  webinar_title: text("The webinar's title as it appears, or a short descriptive title if none is stated."),
  summary: text("2-3 plain-language sentences to the presenter on where this webinar stands against the framework."),
  categories: z
    .array(
      z.object({
        key: z.enum(CATEGORY_KEYS),
        points: z.number().describe("Points awarded, from 0 to this category's maximum."),
        status: z.enum(["present", "partial", "missing"]),
        evidence: text("Where it shows up (slide numbers or a short quote), or empty if missing."),
        missing: text("What's missing or weak, in plain language. Empty if nothing."),
        how_to_fix: text("A specific, practical fix for THIS webinar. Empty if nothing to fix."),
      })
    )
    .describe("Exactly one entry per category."),
  strengths: z.array(z.string()).describe("2-5 things this webinar already does well."),
  top_fixes: z
    .array(z.object({ title: z.string(), why: z.string(), how: z.string() }))
    .describe("The 3-5 highest-impact improvements, most important first."),
  critical_issues: z
    .array(z.object({ issue: z.string(), evidence: z.string(), why_it_matters: z.string() }))
    .describe(
      "Only claims that could create legal or trust problems: income or result claims without proof, guaranteed outcomes, fake scarcity or deadlines, misleading price comparisons. Empty if none."
    ),
  extracted: z
    .object({
      business_name: text("Empty string if not stated."),
      industry: text("Empty string if not stated."),
      product: text("What's being sold. Empty string if not stated."),
      offer_name: text("Empty string if not stated."),
      audience: text("Who it's for. Empty string if not stated."),
      pain_points: text("Empty string if not stated."),
      false_beliefs: text("Objections or false beliefs it addresses. Empty string if not stated."),
      desired_transformation: text("Empty string if not stated."),
      enemy: text("What the webinar positions against. Empty string if not stated."),
      differentiator: text("Empty string if not stated."),
      unique_mechanism: text("The named method or system. Empty string if not stated."),
      core_promise: text("Empty string if not stated."),
      outcomes: text("Results and benefits promised, one per line. Empty string if not stated."),
      proof: text("Testimonials, results, and case studies exactly as stated. Empty string if none."),
      price: text("Empty string if not stated."),
      guarantee: text("Empty string if not stated."),
      scarcity_urgency: text("Empty string if not stated."),
      cta: text("Empty string if not stated."),
      stack_items: z
        .array(
          z.object({
            name: z.string(),
            value: text("As stated, e.g. \"$997\"; empty string if no value given."),
            category: z.enum(["stack", "bonus"]),
          })
        )
        .describe("Offer components (stack) and bonuses, in the order presented. Empty if none."),
      fast_action_bonuses: z
        .array(z.object({ name: z.string(), value: z.string(), condition: z.string() }))
        .describe("Bonuses tied to acting fast, with their condition. Empty if none."),
      presenter: z.object({
        mission: text("What the presenter helps people do. Empty string if not stated."),
        origin_story: text("Empty string if not told."),
        signature_win: text("Their best client result. Empty string if not stated."),
        setback_story: text("Empty string if not told."),
        credentials: text("Empty string if not stated."),
        years_experience: text("Empty string if not stated."),
        family: text("Family or personal life. Empty string if not stated."),
        relatable_detail: text("Empty string if not stated."),
        mission_why: text("Their personal why. Empty string if not stated."),
      }),
    })
    .describe("Facts stated in the webinar itself, copied faithfully — never invented. Empty strings for anything not stated."),
});

export type WebinarScoreAnalysis = z.infer<typeof webinarScoreAnalysisSchema>;

export type WebinarScoreCategory = {
  key: WebinarScoreCategoryKey;
  label: string;
  max: number;
  points: number;
  status: "present" | "partial" | "missing";
  evidence: string;
  missing: string;
  how_to_fix: string;
};

// The server's own math: one entry per category (a skipped one scores 0), points clamped to the
// category's max, and the total summed here rather than taken from the AI.
export function scoreWebinar(analysis: WebinarScoreAnalysis): { categories: WebinarScoreCategory[]; total: number } {
  const categories = WEBINAR_SCORE_CATEGORIES.map((c) => {
    const found = analysis.categories.find((x) => x.key === c.key);
    return {
      key: c.key,
      label: c.label,
      max: c.max,
      points: found ? Math.max(0, Math.min(c.max, Math.round(found.points))) : 0,
      status: found?.status ?? "missing",
      evidence: found?.evidence ?? "",
      missing: found?.missing ?? "Not assessed — run the score again.",
      how_to_fix: found?.how_to_fix ?? "",
    };
  });
  return { categories, total: categories.reduce((sum, c) => sum + c.points, 0) };
}

export type WebinarReadiness = "framework_ready" | "improvements_recommended" | "needs_work" | "rebuild_recommended";

// Below 50 the webinar is missing too much of the framework to patch — rebuild it from Discovery.
export const WEBINAR_REBUILD_THRESHOLD = 50;

export function webinarReadiness(score: number): WebinarReadiness {
  if (score >= 85) return "framework_ready";
  if (score >= 70) return "improvements_recommended";
  if (score >= WEBINAR_REBUILD_THRESHOLD) return "needs_work";
  return "rebuild_recommended";
}

export const WEBINAR_READINESS_LABELS: Record<WebinarReadiness, { label: string; description: string }> = {
  framework_ready: { label: "Framework Ready", description: "Follows the framework closely — polish the details." },
  improvements_recommended: {
    label: "Strong — Improvements Recommended",
    description: "Most of the framework is there; a few pieces would lift conversions.",
  },
  needs_work: { label: "Needs Work", description: "Important pieces of the framework are missing or weak." },
  rebuild_recommended: {
    label: "Rebuild Recommended",
    description: "Too much of the framework is missing to patch — rebuild it with Pitch Perfect AI.",
  },
};

export const WEBINAR_SCORE_CREDIT_COST = 8;
export const WEBINAR_SCORE_MAX_OUTPUT_TOKENS = 14000;
export const WEBINAR_SCORE_MIN_CHARS = 500;
export const WEBINAR_SCORE_MAX_CHARS = 120000;
