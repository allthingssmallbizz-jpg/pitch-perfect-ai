// The AI review's structured output: one zod schema that is both sent to Claude as the tool's
// input schema and used to validate what comes back, plus the scoring rules the server applies on
// top of it. The model proposes points per category; the server clamps them, sums the total, and
// sets readiness itself — the AI never decides the final score or the readiness label.

import { z } from "zod";
import type { StrategyReadiness } from "@/types/database";

export const STRATEGY_CATEGORIES = [
  {
    key: "audience_clarity",
    label: "Audience clarity",
    max: 10,
    criteria:
      "A specific, reachable customer (who, situation, stage of life/business); a real buying motivation; the audience can actually be reached; the audience matches the product.",
  },
  {
    key: "problem_strength",
    label: "Problem and desire strength",
    max: 10,
    criteria:
      "The problem/desire is specific and recognized by the audience; there's a genuine reason to act now; the cost of leaving it unsolved is real (not exaggerated); the product genuinely addresses it.",
  },
  {
    key: "offer_clarity",
    label: "Offer clarity",
    max: 10,
    criteria:
      "A buyer can understand what's being sold in one sentence: clear deliverables, inclusions, format, price, and no conflicting promises.",
  },
  {
    key: "promise_credibility",
    label: "Core promise credibility",
    max: 10,
    criteria: "The core promise is specific, meaningful, believable, and supported by the proof provided; no unrealistic or unsupported guarantees.",
  },
  {
    key: "differentiation",
    label: "Differentiation",
    max: 10,
    criteria:
      "A real distinction from alternatives grounded in process, specialization, experience, service model, delivery method, or documented advantage — not generic claims like 'best service' or 'we care'.",
  },
  {
    key: "awareness_alignment",
    label: "Awareness alignment",
    max: 5,
    criteria: "The selected awareness stage matches the audience and the rest of the discovery, so the opening, education, proof, and offer can be pitched at the right level.",
  },
  {
    key: "objection_coverage",
    label: "Objection coverage",
    max: 10,
    criteria: "The main purchase objections (price, trust, timing, complexity, uncertainty, alternatives, risk) are identified and each has an ethical response available.",
  },
  {
    key: "value_strategy",
    label: "Value and bonus strategy",
    max: 10,
    criteria:
      "Each bonus solves a relevant problem, complements the core offer, is deliverable, isn't double-counted, and any stated value has a defensible basis.",
  },
  {
    key: "proof_credibility",
    label: "Proof and credibility",
    max: 10,
    criteria: "Enough real evidence (testimonials, case studies, demonstrations, experience, verifiable results) to support the major claims.",
  },
  {
    key: "scarcity_integrity",
    label: "Scarcity and urgency integrity",
    max: 5,
    criteria: "Every scarcity/urgency claim is genuine (real dates, real capacity, documented expirations). Full points if there is no scarcity claimed at all — none is better than invented.",
  },
  {
    key: "funnel_alignment",
    label: "Funnel and CTA alignment",
    max: 10,
    criteria: "The funnel and CTA fit the price, purchase complexity, awareness level, need for consultation, and the real next step; the CTA matches what actually happens next.",
  },
] as const;

export type StrategyCategoryKey = (typeof STRATEGY_CATEGORIES)[number]["key"];
const CATEGORY_KEYS = STRATEGY_CATEGORIES.map((c) => c.key) as [StrategyCategoryKey, ...StrategyCategoryKey[]];

export const PRESENTATION_FRAMEWORKS = [
  "Perfect Webinar",
  "AIDA",
  "PAS",
  "StoryBrand",
  "25-Part VSL",
  "Problem-Solution",
  "Before-After-Bridge",
  "Consultative Sales Presentation",
] as const;

const evidenceStatus = z.enum(["verified", "client_reported", "proposed", "missing_evidence", "contradictory", "not_applicable"]);

export const strategyAnalysisSchema = z.object({
  summary: z.string().describe("2-3 plain-language sentences on the overall strategy, written to the business owner."),
  one_sentence_offer: z.string().describe("The offer explained in one clear sentence, using only what discovery says."),
  categories: z
    .array(
      z.object({
        key: z.enum(CATEGORY_KEYS),
        points: z.number().describe("Points awarded, from 0 to this category's maximum."),
        rationale: z.string().describe("Why these points were awarded or deducted, in plain language."),
        criteria_met: z.array(z.string()),
        criteria_missed: z.array(z.string()),
      })
    )
    .describe("Exactly one entry per category."),
  critical_issues: z
    .array(
      z.object({
        field_id: z.string(),
        claim: z.string().describe("The exact claim as the client wrote it."),
        issue: z.string(),
        why_it_matters: z.string(),
        required_action: z.enum(["remove", "substantiate", "qualify", "correct"]),
        suggested_answer: z.string().describe("A compliant rewrite of the client's answer. Empty string if the claim should simply be removed."),
      })
    )
    .describe("Only fabricated or unsupported proof, misleading scarcity/urgency, unsupported guarantees or income claims, and misleading price comparisons. Empty if none."),
  recommendations: z.array(
    z.object({
      field_id: z.string(),
      issue: z.string(),
      why_it_matters: z.string().describe("Why this matters to the potential buyer."),
      suggested_answer: z.string().describe("A rewritten, stronger answer for that field, built only from facts in discovery. Use [brackets] for anything the client must supply."),
      evidence_status: evidenceStatus,
      severity: z.enum(["high", "medium", "low"]),
      requires_confirmation: z.boolean().describe("True when the rewrite adds or assumes anything the client must confirm."),
      follow_up_question: z.string().nullable().describe("One focused question to ask the client when information is missing, else null."),
    })
  ),
  claims: z.array(
    z.object({
      field_id: z.string(),
      claim: z.string(),
      status: evidenceStatus,
    })
  ),
  objections: z.array(
    z.object({
      objection: z.string(),
      response: z.string().describe("An ethical response using explanation, demonstration, real evidence, or transparent offer terms."),
      response_type: z.enum(["explanation", "demonstration", "evidence", "offer_terms"]),
      coverage: z.enum(["covered", "partial", "missing"]),
    })
  ),
  offer_review: z.object({
    core_offer_summary: z.string(),
    includes: z.array(z.string()),
    actual_price: z.string(),
    fulfillment: z.string().describe("How the core offer is delivered, or 'Not specified'."),
    defensible_value: z.string().nullable().describe("Core offer value only if discovery supports it, else null."),
    bonuses: z.array(
      z.object({
        name: z.string(),
        customer_benefit: z.string(),
        deliverable: z.string(),
        delivery_cost: z.string().nullable(),
        supported_value: z.string().nullable().describe("The dollar value only when it has a defensible basis, else null."),
        value_basis: z.string().describe("Why the value is or isn't supportable."),
        eligibility: z.string().nullable(),
        availability: z.string().nullable(),
        double_counted: z.boolean().describe("True if it's already part of the core offer."),
        verdict: z.enum(["keep", "revise", "drop"]),
      })
    ),
    total_supported_value: z.string().nullable().describe("Sum of only the supported values, or null if none are supportable."),
    value_explanation: z.string().describe("A customer-facing explanation of the value that relies on no invented numbers."),
    fast_action: z.array(
      z.object({
        name: z.string(),
        deadline: z.string().nullable(),
        eligibility: z.string().nullable(),
        what_buyer_gets: z.string(),
        after_expiration: z.string().nullable(),
        fulfillable: z.enum(["yes", "no", "unclear"]),
        note: z.string(),
      })
    ),
    industry_specific_checks: z
      .array(z.string())
      .describe("Industry-specific terms to verify (e.g. for travel: supplier terms, capacity, cancellation, deposits, payment deadlines, whether promised extras can be delivered). Empty if none apply."),
  }),
  scarcity_items: z.array(
    z.object({
      claim: z.string(),
      status: z.enum(["genuine", "unverified", "misleading"]),
      note: z.string(),
    })
  ),
  funnel: z.object({ current: z.string(), recommended: z.string(), reason: z.string() }),
  awareness: z.object({ selected: z.string(), recommended: z.string(), reason: z.string() }),
  recommended_framework: z.object({ name: z.enum(PRESENTATION_FRAMEWORKS), reason: z.string() }),
  follow_up_questions: z
    .array(z.object({ field_id: z.string(), question: z.string() }))
    .describe("Questions for missing information, most important first. At most 5."),
  assumptions: z.array(z.string()).describe("Every assumption this review made. Empty if none."),
});

export type StrategyAnalysis = z.infer<typeof strategyAnalysisSchema>;

export const coachReplySchema = z.object({
  reply: z.string().describe("Your answer to the business owner, plain language, 2-6 sentences."),
  suggested_answer: z
    .string()
    .nullable()
    .describe("A new suggested answer for the field when you are offering one (an alternative, or one built from information they just gave), else null."),
  follow_up_question: z.string().nullable().describe("One focused follow-up question if you still need information, else null."),
});

export type CoachReply = z.infer<typeof coachReplySchema>;

export type CategoryScore = {
  key: StrategyCategoryKey;
  label: string;
  max: number;
  points: number;
  rationale: string;
  criteria_met: string[];
  criteria_missed: string[];
};

// The server's own scoring: one entry per category (a missing one scores 0 with an explanation),
// points clamped to the category max and rounded, total summed here rather than taken from the AI.
export function scoreCategories(analysis: StrategyAnalysis): { categories: CategoryScore[]; total: number } {
  const categories: CategoryScore[] = STRATEGY_CATEGORIES.map((c) => {
    const found = analysis.categories.find((x) => x.key === c.key);
    const points = found ? Math.max(0, Math.min(c.max, Math.round(found.points))) : 0;
    return {
      key: c.key,
      label: c.label,
      max: c.max,
      points,
      rationale: found?.rationale ?? "Not assessed in this review — rerun the analysis.",
      criteria_met: found?.criteria_met ?? [],
      criteria_missed: found?.criteria_missed ?? [],
    };
  });
  return { categories, total: categories.reduce((sum, c) => sum + c.points, 0) };
}

export function readinessForScore(score: number): StrategyReadiness {
  if (score >= 85) return "presentation_ready";
  if (score >= 70) return "improvements_recommended";
  if (score >= 50) return "needs_refinement";
  return "not_ready";
}

export const READINESS_LABELS: Record<StrategyReadiness, { label: string; description: string }> = {
  presentation_ready: { label: "Presentation Ready", description: "Strong strategic foundation." },
  improvements_recommended: {
    label: "Improvements Recommended",
    description: "Usable strategy with meaningful improvement opportunities.",
  },
  needs_refinement: { label: "Needs Strategic Refinement", description: "Important weaknesses should be addressed." },
  not_ready: { label: "Not Ready", description: "Major discovery or positioning gaps." },
};

export const STRATEGY_REVIEW_CREDIT_COST = 3;
export const STRATEGY_COACH_CREDIT_COST = 1;
export const STRATEGY_REVIEW_MAX_OUTPUT_TOKENS = 16000;
export const STRATEGY_COACH_MAX_OUTPUT_TOKENS = 1200;

// The presentation agents that pass through the strategy checkpoint. Every other agent still
// reads an approved blueprint when one exists, but isn't held up waiting for one.
export const STRATEGY_GATED_ASSET_TYPES = [
  "webinar_outline",
  "ppt_outline",
  "webinar_script",
  "vsl_script",
  "challenge_outline",
  "challenge_day_slides",
] as const;

export const EVIDENCE_LABELS: Record<string, string> = {
  verified: "Verified (source provided)",
  client_reported: "Client-reported, unverified",
  proposed: "Proposed",
  missing_evidence: "Missing evidence",
  contradictory: "Contradictory",
  not_applicable: "—",
};
