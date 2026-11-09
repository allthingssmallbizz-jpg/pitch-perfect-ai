// The Approved Presentation Strategy Blueprint: built deterministically (no extra AI call) from
// the analyzed review plus the member's own decisions on each recommendation, then frozen on
// approval. Pure, so the Strategy Review screen can preview exactly what approving will save.

import type { StrategyRecommendation } from "@/types/database";
import { getFunnelTypeLabel } from "@/lib/funnelType";
import { applyAcceptedRevisions, getFieldLabel, getFieldValue, type StrategyFields } from "./fields";
import type { StrategyAnalysis } from "./schema";

type RecLike = Pick<
  StrategyRecommendation,
  | "id"
  | "field_id"
  | "field_label"
  | "original_answer"
  | "issue"
  | "suggested_answer"
  | "final_answer"
  | "approval_status"
  | "is_critical"
  | "client_note"
  | "evidence_status"
>;

export type Blueprint = {
  business_name: string;
  target_audience: string;
  awareness_stage: string;
  primary_problem: string;
  desired_transformation: string;
  core_promise: string;
  differentiator: string;
  false_beliefs: string;
  objections: { objection: string; response: string }[];
  core_offer: { summary: string; price: string };
  proof: string;
  claim_statuses: { claim: string; status: string }[];
  bonus_stack: { name: string; supported_value: string | null; verdict: string; note: string }[];
  total_supported_value: string | null;
  value_explanation: string;
  scarcity: { claim: string; status: string; note: string }[];
  cta: string;
  funnel_type: string;
  framework: { name: string; reason: string };
  accepted_revisions: { field: string; original: string; revised: string }[];
  excluded_claims: { field: string; claim: string }[];
  attested_claims: { field: string; claim: string; note: string }[];
  // Critical issues the member chose to move past without fixing, removing, or vouching for
  // (Live mode never blocks). Optional: blueprints approved before this existed don't have it.
  unresolved_critical?: { field: string; claim: string }[];
  warnings: string[];
  assumptions: string[];
};

export type ApprovalCheck = {
  // Hard stops. Nothing produces one today — kept so callers stay explicit about it.
  blockers: string[];
  // Open critical issues (Live mode). Never blocking, but approving past them needs its own,
  // explicit acknowledgment on top of the ordinary warnings.
  critical: string[];
  warnings: string[];
};

// Why the critical items matter — shown wherever a member chooses to move past them.
export const CRITICAL_RISK_EXPLANATION =
  "Critical items are claims a buyer, an ad platform, or a regulator could challenge: results or income you can't prove, reviews or client counts you can't show, guarantees you can't honor, and deadlines or limits that aren't real. Presenting them without proof can break advertising and consumer-protection rules (including rules on earnings claims and testimonials), get ads rejected, lead to refunds and chargebacks, and cost you buyers' trust the moment someone checks.";

// A critical issue is resolved when it's rewritten (accepted), removed from generated content
// (excluded), or kept with the member's own attestation and evidence note (attested). Nothing ever
// blocks approval: in Live mode open critical issues are listed separately and need an explicit
// "I understand" acknowledgment; in Demo mode (example data from a template, see 0052_demo_mode.sql)
// they're ordinary warnings naming what a live presentation would need.
export function checkApproval(input: {
  score: number;
  recs: RecLike[];
  discoveryChangedSinceReview: boolean;
  demo?: boolean;
}): ApprovalCheck {
  const blockers: string[] = [];
  const critical: string[] = [];
  const warnings: string[] = [];
  for (const rec of input.recs) {
    if (isOpenCritical(rec)) {
      if (input.demo) warnings.push(`Demo only — a live presentation would need this fixed: ${rec.issue}`);
      else critical.push(rec.issue);
    }
  }
  if (input.score < 70) warnings.push(`Strategy readiness score is ${input.score}/100 — below the recommended 70.`);
  const pending = input.recs.filter((r) => !r.is_critical && r.approval_status === "pending").length;
  if (pending) warnings.push(`${pending} recommendation${pending === 1 ? " hasn't" : "s haven't"} been decided — the original answers will be used.`);
  const needsInfo = input.recs.filter((r) => r.approval_status === "needs_info").length;
  if (needsInfo) warnings.push(`${needsInfo} item${needsInfo === 1 ? " is" : "s are"} marked as needing more information.`);
  if (input.discoveryChangedSinceReview) {
    warnings.push("Discovery was edited after this review ran. Approving uses the reviewed answers — reanalyze to include the newer edits.");
  }
  return { blockers, critical, warnings };
}

export function isOpenCritical(rec: Pick<RecLike, "is_critical" | "approval_status">): boolean {
  return rec.is_critical && !["accepted", "excluded", "attested"].includes(rec.approval_status);
}

export function buildBlueprint(input: {
  analyzedFields: StrategyFields;
  analysis: StrategyAnalysis;
  recs: RecLike[];
  warnings: string[];
}): { blueprint: Blueprint; approvedFields: StrategyFields } {
  const { analysis, recs } = input;
  const approvedFields = applyAcceptedRevisions(input.analyzedFields, recs);
  const f = approvedFields;

  const accepted_revisions = recs
    .filter((r) => r.approval_status === "accepted" && r.field_id !== "general")
    .map((r) => ({
      field: r.field_label || getFieldLabel(f, r.field_id),
      original: r.original_answer,
      revised: getFieldValue(f, r.field_id),
    }));
  const excluded_claims = recs
    .filter((r) => r.approval_status === "excluded")
    .map((r) => ({ field: r.field_label, claim: r.issue }));
  const attested_claims = recs
    .filter((r) => r.approval_status === "attested")
    .map((r) => ({ field: r.field_label, claim: r.issue, note: r.client_note ?? "" }));

  const blueprint: Blueprint = {
    business_name: f.business_name,
    target_audience: f.audience,
    awareness_stage: f.awareness_level,
    primary_problem: f.pain_points,
    desired_transformation: f.desired_transformation,
    core_promise: f.core_promise,
    differentiator: [f.unique_mechanism, f.differentiator].filter((x) => x.trim()).join(" — "),
    false_beliefs: f.false_beliefs,
    objections: analysis.objections.map((o) => ({ objection: o.objection, response: o.response })),
    core_offer: { summary: analysis.one_sentence_offer || analysis.offer_review.core_offer_summary, price: f.price },
    proof: f.proof,
    claim_statuses: analysis.claims.map((c) => ({ claim: c.claim, status: c.status })),
    bonus_stack: analysis.offer_review.bonuses.map((b) => ({
      name: b.name,
      supported_value: b.supported_value,
      verdict: b.verdict,
      note: b.value_basis,
    })),
    total_supported_value: analysis.offer_review.total_supported_value,
    value_explanation: analysis.offer_review.value_explanation,
    scarcity: analysis.scarcity_items.map((s) => ({ claim: s.claim, status: s.status, note: s.note })),
    cta: f.cta,
    funnel_type: getFunnelTypeLabel(f.funnel_type),
    framework: { name: analysis.recommended_framework.name, reason: analysis.recommended_framework.reason },
    accepted_revisions,
    excluded_claims,
    attested_claims,
    unresolved_critical: recs.filter(isOpenCritical).map((r) => ({ field: r.field_label, claim: r.issue })),
    warnings: input.warnings,
    assumptions: analysis.assumptions,
  };
  return { blueprint, approvedFields };
}

// Appended to every generator's prompt while an approved blueprint exists. The Discovery block
// the generator already includes is built from the approved fields (see applyApprovedFields), so
// this only adds what Discovery can't express: the framework, objection handling, claim
// restrictions, and what counts as genuine scarcity.
export function formatStrategyBlueprintBlock(b: Blueprint, version: number, approvedAt: string): string {
  const lines: string[] = [
    "",
    `APPROVED STRATEGY BLUEPRINT (version ${version}, approved ${approvedAt.slice(0, 10)}) — the client reviewed and approved this strategy. The DISCOVERY facts above already reflect the approved answers; where anything conflicts, the approved strategy wins.`,
    `- Recommended presentation framework (for presentations, webinars, VSLs, and challenge pitches): ${b.framework.name} — ${b.framework.reason}`,
    `- The offer in one sentence: ${b.core_offer.summary}`,
  ];
  if (b.objections.length) {
    lines.push("- Top objections and the approved way to answer each:");
    for (const o of b.objections) lines.push(`  • ${o.objection} → ${o.response}`);
  }
  if (b.value_explanation) lines.push(`- How to explain the value without invented numbers: ${b.value_explanation}`);
  const unsupported = b.bonus_stack.filter((x) => !x.supported_value).map((x) => x.name);
  if (unsupported.length) {
    lines.push(
      `- These items have no verified dollar value — present them as added benefits and never claim an independent market value for them: ${unsupported.join("; ")}`
    );
  }
  if (b.scarcity.length) {
    lines.push("- Scarcity/urgency as reviewed (state only genuine items as fact; never present unverified or misleading ones as fact):");
    for (const s of b.scarcity) lines.push(`  • [${s.status}] ${s.claim}`);
  }
  if (b.excluded_claims.length) {
    lines.push("- EXCLUDED CLAIMS — the client removed these; never state, imply, or paraphrase them:");
    for (const c of b.excluded_claims) lines.push(`  • ${c.claim}`);
  }
  if (b.attested_claims.length) {
    lines.push(
      "- Client-attested claims — may only be stated as the client's own report, qualified as such, never as independently verified:"
    );
    for (const c of b.attested_claims) lines.push(`  • ${c.claim}${c.note ? ` (client's evidence: ${c.note})` : ""}`);
  }
  if (b.unresolved_critical?.length) {
    lines.push(
      "- UNPROVEN CLAIMS the client chose to keep without evidence — never present them as verified fact, never add specific numbers, results, or guarantees to them, and soften them to the client's own statement:"
    );
    for (const c of b.unresolved_critical) lines.push(`  • ${c.claim}`);
  }
  const unverified = b.claim_statuses.filter((c) => c.status !== "verified" && c.status !== "not_applicable");
  if (unverified.length) {
    lines.push("- Evidence status of key claims (never upgrade a claim beyond its status):");
    for (const c of unverified.slice(0, 12)) lines.push(`  • [${c.status}] ${c.claim}`);
  }
  lines.push("- Never present AI-suggested or assumed details as verified facts, and never invent proof, results, or testimonials.");
  return lines.join("\n");
}
