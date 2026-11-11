import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateStructured } from "@/lib/ai/anthropic";
import { buildWebinarScorePrompt } from "@/lib/webinarScore/prompt";
import {
  scoreWebinar,
  webinarReadiness,
  webinarScoreAnalysisSchema,
  WEBINAR_SCORE_CREDIT_COST,
  WEBINAR_SCORE_MAX_CHARS,
  WEBINAR_SCORE_MAX_OUTPUT_TOKENS,
  WEBINAR_SCORE_MIN_CHARS,
} from "@/lib/webinarScore/schema";

export const runtime = "nodejs";
// One long structured AI call (plus at most one validation retry).
export const maxDuration = 300;

// A score still "pending" this long after it started was cut off mid-run and will never finish.
const STALE_PENDING_MS = 6 * 60 * 1000;

const requestSchema = z.object({
  title: z.string().trim().max(200).default(""),
  sourceType: z.enum(["pptx", "text"]),
  slideCount: z.number().int().positive().max(1000).nullable().default(null),
  content: z
    .string()
    .trim()
    .min(WEBINAR_SCORE_MIN_CHARS, "That's too short to score — upload the full deck or paste the whole script.")
    .max(
      WEBINAR_SCORE_MAX_CHARS,
      `That's too long to score in one go — keep it under ${WEBINAR_SCORE_MAX_CHARS.toLocaleString()} characters.`
    ),
});

// Scores an existing webinar against the framework. Credits are charged only when it succeeds.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const input = parsed.data;
  const admin = createAdminClient();

  await admin
    .from("webinar_scores")
    .update({ status: "failed", error: "Timed out — please score it again.", updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - STALE_PENDING_MS).toISOString());

  const guardrail = await checkGuardrails(user.id, WEBINAR_SCORE_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  const { data: pending, error: insertError } = await admin
    .from("webinar_scores")
    .insert({
      user_id: user.id,
      title: input.title,
      source_type: input.sourceType,
      source_text: input.content,
      slide_count: input.slideCount,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !pending) {
    return NextResponse.json({ error: "Could not start scoring — please try again." }, { status: 500 });
  }

  try {
    const { system, user: userPrompt } = buildWebinarScorePrompt(input);
    const result = await generateStructured(system, userPrompt, WEBINAR_SCORE_MAX_OUTPUT_TOKENS, {
      name: "submit_webinar_score",
      description: "Submit the complete webinar score.",
      schema: webinarScoreAnalysisSchema,
    });
    const { categories, total } = scoreWebinar(result.data);
    const title = input.title || result.data.webinar_title || "My webinar";

    const { error: updateError } = await admin
      .from("webinar_scores")
      .update({
        status: "complete",
        title,
        score: total,
        readiness: webinarReadiness(total),
        analysis: { ...result.data, categories },
        model: result.model,
        cost_usd: result.costUsd,
        credits_charged: WEBINAR_SCORE_CREDIT_COST,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pending.id);
    if (updateError) throw new Error(`Scored, but could not save the result: ${updateError.message}`);

    await decrementCredits(user.id, WEBINAR_SCORE_CREDIT_COST);
    return NextResponse.json({ id: pending.id, score: total });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scoring failed";
    await admin
      .from("webinar_scores")
      .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
      .eq("id", pending.id);
    return NextResponse.json(
      { error: `Scoring didn't finish: ${message} You were not charged credits.`, id: pending.id },
      { status: 502 }
    );
  }
}
