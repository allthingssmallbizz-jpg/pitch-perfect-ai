import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildBlueprint, checkApproval } from "@/lib/strategy/blueprint";
import { extractStrategyFields, strategyFieldsFromJson } from "@/lib/strategy/fields";
import { strategyAnalysisSchema } from "@/lib/strategy/schema";
import { hashStrategyFields, loadStrategyState } from "@/lib/strategy/server";

export const runtime = "nodejs";

const requestSchema = z.object({ acknowledgeWarnings: z.boolean().default(false) });

// Approves the latest review as a new, frozen Strategy Blueprint version — the input every
// generator reads from from now on (see /api/generate). Approving again creates a new version and
// supersedes the previous one; an approved blueprint itself is never edited afterward.
export async function POST(req: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const admin = createAdminClient();
  const { data: review } = await admin.from("strategy_reviews").select("*").eq("id", reviewId).maybeSingle();
  if (!review || review.user_id !== user.id) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  const { data: project } = await admin.from("projects").select("*").eq("id", review.project_id).is("deleted_at", null).maybeSingle();
  if (!project || project.user_id !== user.id) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  const { data: latest } = await admin
    .from("strategy_reviews")
    .select("id")
    .eq("project_id", project.id)
    .order("review_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest?.id !== review.id || review.status !== "complete") {
    return NextResponse.json({ error: "Only the latest completed review can be approved." }, { status: 409 });
  }
  const analysis = strategyAnalysisSchema.safeParse(review.analysis);
  if (!analysis.success) return NextResponse.json({ error: "This review is incomplete — please reanalyze." }, { status: 409 });

  const { data: recs } = await admin.from("strategy_recommendations").select("*").eq("review_id", review.id).order("position");
  const currentHash = hashStrategyFields(extractStrategyFields(project));
  const check = checkApproval({
    score: review.overall_score ?? 0,
    recs: recs ?? [],
    discoveryChangedSinceReview: review.discovery_hash !== currentHash,
  });
  if (check.blockers.length) {
    return NextResponse.json({ error: "Resolve every critical issue before approving.", blockers: check.blockers }, { status: 400 });
  }
  if (check.warnings.length && !parsed.data.acknowledgeWarnings) {
    return NextResponse.json({ error: "Please confirm the warnings before approving.", warnings: check.warnings, code: "confirm_warnings" }, { status: 409 });
  }

  const { blueprint, approvedFields } = buildBlueprint({
    analyzedFields: strategyFieldsFromJson(review.input_fields),
    analysis: analysis.data,
    recs: recs ?? [],
    warnings: check.warnings,
  });

  const { data: lastBlueprint } = await admin
    .from("strategy_blueprints")
    .select("blueprint_version")
    .eq("project_id", project.id)
    .order("blueprint_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const now = new Date().toISOString();
  const { data: previous } = await admin
    .from("strategy_blueprints")
    .update({ superseded_at: now })
    .eq("project_id", project.id)
    .is("superseded_at", null)
    .select("id");

  const { error } = await admin.from("strategy_blueprints").insert({
    project_id: project.id,
    user_id: user.id,
    review_id: review.id,
    blueprint_version: (lastBlueprint?.blueprint_version ?? 0) + 1,
    approved_fields: approvedFields as unknown as Record<string, unknown>,
    blueprint,
    selected_framework: blueprint.framework.name,
    framework_reason: blueprint.framework.reason,
    excluded_claims: blueprint.excluded_claims,
    warnings: blueprint.warnings,
    // The review's own Discovery snapshot, so "Discovery changed since approval" means edits made
    // after the analysis this blueprint is built from, not just after the click.
    discovery_hash: review.discovery_hash,
  });
  if (error) {
    // Put the previous approval back rather than leaving the project with none.
    if (previous?.length) {
      await admin.from("strategy_blueprints").update({ superseded_at: null }).in("id", previous.map((p) => p.id));
    }
    return NextResponse.json({ error: "Could not save the approval — please try again." }, { status: 500 });
  }
  return NextResponse.json(await loadStrategyState(admin, project));
}
