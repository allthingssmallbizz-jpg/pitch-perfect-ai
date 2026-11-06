// Server-only helpers for Strategy Review: ownership checks, loading a project's strategy state,
// and building the input for a new analysis. Uses node:crypto, so never import from a client file.

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Database,
  Project,
  StrategyBlueprint,
  StrategyRecommendation,
  StrategyReview,
} from "@/types/database";
import {
  extractStrategyFields,
  getFieldValue,
  isKnownFieldId,
  serializeStrategyFields,
  setFieldValue,
  strategyFieldsFromJson,
  type StrategyFields,
} from "./fields";

export function hashStrategyFields(fields: StrategyFields): string {
  return createHash("sha256").update(serializeStrategyFields(fields)).digest("hex");
}

// Verifies the signed-in user owns this (non-deleted) project. Never trusts a client-supplied id
// on its own — every strategy route goes through this or an equivalent check.
export async function getOwnedProjectForStrategy(
  projectId: string
): Promise<{ userId: string; project: Project } | { error: string; status: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", status: 401 };
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project || project.user_id !== user.id) return { error: "Project not found", status: 404 };
  return { userId: user.id, project };
}

export type StrategyState = {
  review: StrategyReview | null;
  recommendations: StrategyRecommendation[];
  blueprint: StrategyBlueprint | null;
  discoveryChangedSinceReview: boolean;
  discoveryChangedSinceApproval: boolean;
};

export async function loadStrategyState(
  admin: SupabaseClient<Database>,
  project: Project
): Promise<StrategyState> {
  const [{ data: review }, { data: blueprint }] = await Promise.all([
    admin
      .from("strategy_reviews")
      .select("*")
      .eq("project_id", project.id)
      .order("review_version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("strategy_blueprints")
      .select("*")
      .eq("project_id", project.id)
      .is("superseded_at", null)
      .maybeSingle(),
  ]);
  const { data: recommendations } = review
    ? await admin.from("strategy_recommendations").select("*").eq("review_id", review.id).order("position")
    : { data: [] as StrategyRecommendation[] };
  const currentHash = hashStrategyFields(extractStrategyFields(project));
  return {
    review: review ?? null,
    recommendations: recommendations ?? [],
    blueprint: blueprint ?? null,
    discoveryChangedSinceReview: Boolean(review && review.discovery_hash !== currentHash),
    discoveryChangedSinceApproval: Boolean(blueprint && blueprint.discovery_hash !== currentHash),
  };
}

// The fields a new analysis reviews: today's Discovery answers, plus every revision the member
// accepted in the previous review — but only for fields they haven't edited in Discovery since.
// A newer manual edit always wins over an older accepted suggestion; nothing is silently undone.
export function buildAnalysisInput(
  project: Project,
  lastReview: StrategyReview | null,
  lastRecs: StrategyRecommendation[]
): { fields: StrategyFields; carried: Record<string, { original: string; revised: string }> } {
  const current = extractStrategyFields(project);
  if (!lastReview) return { fields: current, carried: {} };
  const previousInput = strategyFieldsFromJson(lastReview.input_fields);
  const priorCarried = (lastReview.carried_revisions ?? {}) as Record<string, { original: string; revised: string }>;

  let fields = current;
  const carried: Record<string, { original: string; revised: string }> = {};
  for (const rec of lastRecs) {
    if (rec.approval_status !== "accepted" || rec.field_id === "general") continue;
    if (!isKnownFieldId(rec.field_id, fields)) continue;
    // The previous review analyzed `previousInput`; its "Discovery" value for this field is the
    // original the member saw unless a revision was carried into that review.
    const discoveryThen = priorCarried[rec.field_id]?.original ?? getFieldValue(previousInput, rec.field_id);
    if (getFieldValue(current, rec.field_id) !== discoveryThen) continue;
    const revised = rec.final_answer ?? rec.suggested_answer;
    fields = setFieldValue(fields, rec.field_id, revised);
    carried[rec.field_id] = { original: discoveryThen, revised };
  }
  // Revisions carried into the previous review that weren't revisited this time still apply.
  for (const [fieldId, rev] of Object.entries(priorCarried)) {
    if (carried[fieldId] || !isKnownFieldId(fieldId, fields)) continue;
    if (getFieldValue(current, fieldId) !== rev.original) continue;
    fields = setFieldValue(fields, fieldId, rev.revised);
    carried[fieldId] = rev;
  }
  return { fields, carried };
}

export async function getCurrentBlueprint(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<StrategyBlueprint | null> {
  const { data } = await supabase
    .from("strategy_blueprints")
    .select("*")
    .eq("project_id", projectId)
    .is("superseded_at", null)
    .maybeSingle();
  return data ?? null;
}
