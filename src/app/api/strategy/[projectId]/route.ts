import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateStructured } from "@/lib/ai/anthropic";
import { getPresenterBioBlock } from "@/lib/ai/presenterBio";
import { getFieldLabel, getFieldValue, isKnownFieldId, extractStrategyFields } from "@/lib/strategy/fields";
import {
  readinessForScore,
  scoreCategories,
  strategyAnalysisSchema,
  STRATEGY_REVIEW_CREDIT_COST,
  STRATEGY_REVIEW_MAX_OUTPUT_TOKENS,
} from "@/lib/strategy/schema";
import { buildStrategyReviewPrompt } from "@/lib/strategy/prompt";
import {
  buildAnalysisInput,
  getOwnedProjectForStrategy,
  hashStrategyFields,
  loadStrategyState,
  STALE_PENDING_MS,
  STALE_PENDING_ERROR,
} from "@/lib/strategy/server";
import type { StrategyRecommendation } from "@/types/database";

export const runtime = "nodejs";
// A full review is one long structured AI call (plus at most one validation retry).
export const maxDuration = 300;

// The review stops itself before the platform's 300-second limit, so it always ends with a clear
// "didn't finish, nothing charged" instead of being killed silently and leaving the page waiting.
const REVIEW_BUDGET_MS = 270 * 1000;
// The one validation retry only runs if at least this much of the budget is left.
const RETRY_MIN_MS = 100 * 1000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const owned = await getOwnedProjectForStrategy(projectId);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const state = await loadStrategyState(createAdminClient(), owned.project);
  return NextResponse.json(state);
}

// Runs (or reruns) the Strategy Review. Never modifies Discovery: the analyzed inputs, the AI
// output, and every recommendation are stored on new strategy rows.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const startedAt = Date.now();
  const { projectId } = await params;
  const owned = await getOwnedProjectForStrategy(projectId);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const { userId, project } = owned;
  const admin = createAdminClient();

  await admin
    .from("strategy_reviews")
    .update({ status: "failed", error: STALE_PENDING_ERROR, updated_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - STALE_PENDING_MS).toISOString());

  const guardrail = await checkGuardrails(userId, STRATEGY_REVIEW_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  const { data: lastComplete } = await admin
    .from("strategy_reviews")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "complete")
    .order("review_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: lastRecs } = lastComplete
    ? await admin.from("strategy_recommendations").select("*").eq("review_id", lastComplete.id)
    : { data: [] as StrategyRecommendation[] };
  const { fields, carried } = buildAnalysisInput(project, lastComplete ?? null, lastRecs ?? []);

  const { data: latest } = await admin
    .from("strategy_reviews")
    .select("review_version")
    .eq("project_id", projectId)
    .order("review_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pending, error: insertError } = await admin
    .from("strategy_reviews")
    .insert({
      project_id: projectId,
      user_id: userId,
      review_version: (latest?.review_version ?? 0) + 1,
      status: "pending",
      input_fields: fields as unknown as Record<string, unknown>,
      carried_revisions: carried,
      discovery_hash: hashStrategyFields(extractStrategyFields(project)),
    })
    .select("id")
    .single();
  if (insertError || !pending) {
    return NextResponse.json(
      { error: "A strategy review is already running for this project — give it a minute.", code: "review_in_progress" },
      { status: 409 }
    );
  }

  const deadline = startedAt + REVIEW_BUDGET_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - Date.now()));
  try {
    const presenterBio = await getPresenterBioBlock(admin, project.presenter_bio_profile_id);
    const { system, user } = buildStrategyReviewPrompt(fields, presenterBio, carried);
    // Low effort: the review is a careful read against written rules, not open-ended reasoning —
    // at the default effort the model's thinking alone could take several minutes.
    const result = await generateStructured(
      system,
      user,
      STRATEGY_REVIEW_MAX_OUTPUT_TOKENS,
      {
        name: "submit_strategy_review",
        description: "Submit the complete strategy review.",
        schema: strategyAnalysisSchema,
      },
      { effort: "low", signal: controller.signal, deadline, minRetryMs: RETRY_MIN_MS }
    );
    clearTimeout(timer);
    const analysis = result.data;
    const { categories, total } = scoreCategories(analysis);

    const toFieldId = (id: string) => (isKnownFieldId(id, fields) ? id : "general");
    type NewRec = Omit<StrategyRecommendation, "id" | "created_at" | "updated_at" | "decided_at" | "coach_messages">;
    const recs: NewRec[] = [];
    const base = { review_id: pending.id, project_id: projectId, user_id: userId, final_answer: null, client_note: null };

    for (const issue of analysis.critical_issues) {
      const fieldId = toFieldId(issue.field_id);
      recs.push({
        ...base,
        position: recs.length,
        field_id: fieldId,
        field_label: getFieldLabel(fields, fieldId),
        original_answer: getFieldValue(fields, fieldId),
        issue: `"${issue.claim}" — ${issue.issue}`,
        explanation: issue.why_it_matters,
        suggested_answer: issue.suggested_answer,
        evidence_status: issue.required_action === "correct" ? "contradictory" : "missing_evidence",
        severity: "critical",
        is_critical: true,
        requires_confirmation: true,
        follow_up_question: null,
        approval_status: "pending",
      });
    }
    const order = { high: 0, medium: 1, low: 2 } as const;
    for (const rec of [...analysis.recommendations].sort((a, b) => order[a.severity] - order[b.severity])) {
      const fieldId = toFieldId(rec.field_id);
      recs.push({
        ...base,
        position: recs.length,
        field_id: fieldId,
        field_label: getFieldLabel(fields, fieldId),
        original_answer: getFieldValue(fields, fieldId),
        issue: rec.issue,
        explanation: rec.why_it_matters,
        suggested_answer: rec.suggested_answer,
        evidence_status: rec.evidence_status,
        severity: rec.severity,
        is_critical: false,
        requires_confirmation: rec.requires_confirmation,
        follow_up_question: rec.follow_up_question,
        approval_status: "pending",
      });
    }
    // Missing-information questions that don't already belong to a recommendation become their
    // own items, so the coach can collect the answer and turn it into a suggested revision.
    for (const q of analysis.follow_up_questions.slice(0, 5)) {
      const fieldId = toFieldId(q.field_id);
      if (recs.some((r) => r.field_id === fieldId && fieldId !== "general" && r.follow_up_question)) continue;
      recs.push({
        ...base,
        position: recs.length,
        field_id: fieldId,
        field_label: getFieldLabel(fields, fieldId),
        original_answer: getFieldValue(fields, fieldId),
        issue: "More information needed",
        explanation: "The review couldn't fully assess this without more detail from you — nothing has been assumed.",
        suggested_answer: "",
        evidence_status: "missing_evidence",
        severity: "medium",
        is_critical: false,
        requires_confirmation: true,
        follow_up_question: q.question,
        approval_status: "pending",
      });
    }

    if (recs.length) {
      const { error: recError } = await admin.from("strategy_recommendations").insert(recs);
      if (recError) throw new Error("Could not save the recommendations.");
    }

    const critical = recs.filter((r) => r.is_critical).length;
    await admin
      .from("strategy_reviews")
      .update({
        status: "complete",
        overall_score: total,
        category_scores: categories,
        critical_count: critical,
        readiness_status: readinessForScore(total),
        analysis,
        model: result.model,
        cost_usd: result.costUsd,
        credits_charged: STRATEGY_REVIEW_CREDIT_COST,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pending.id);
    await decrementCredits(userId, STRATEGY_REVIEW_CREDIT_COST);

    return NextResponse.json(await loadStrategyState(admin, project));
  } catch (err) {
    clearTimeout(timer);
    console.error("Strategy review failed:", err);
    const message = controller.signal.aborted
      ? "The strategy review took longer than allowed and was stopped. Nothing was charged and your answers are unchanged — please run it again."
      : err instanceof Error && err.message.startsWith("The AI returned an unusable response")
        ? err.message
        : "The strategy review couldn't finish. Nothing was charged and your answers are unchanged — please try again.";
    await admin
      .from("strategy_reviews")
      .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
      .eq("id", pending.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
