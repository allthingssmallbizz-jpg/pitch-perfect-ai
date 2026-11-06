import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateStructured } from "@/lib/ai/anthropic";
import { getOwnedCurrentRecommendation } from "@/lib/strategy/access";
import { applyAcceptedRevisions, strategyFieldsFromJson } from "@/lib/strategy/fields";
import { buildCoachPrompt } from "@/lib/strategy/prompt";
import { coachReplySchema, STRATEGY_COACH_CREDIT_COST, STRATEGY_COACH_MAX_OUTPUT_TOKENS } from "@/lib/strategy/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  mode: z.enum(["why", "alternative", "message"]),
  message: z.string().trim().max(2000).default(""),
});

// Improve My Strategy: one coaching turn on one recommendation — explain why, offer a genuinely
// different alternative, or answer the member's message (often new information that becomes a
// better suggested answer). A new suggestion replaces the current one; the conversation keeps the
// history, and the member still has to accept it explicitly.
export async function POST(req: NextRequest, { params }: { params: Promise<{ recId: string }> }) {
  const { recId } = await params;
  const owned = await getOwnedCurrentRecommendation(recId);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const { userId, rec, review } = owned;

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { mode, message } = parsed.data;
  if (mode === "message" && !message) return NextResponse.json({ error: "Type a message first." }, { status: 400 });

  const guardrail = await checkGuardrails(userId, STRATEGY_COACH_CREDIT_COST);
  if (!guardrail.ok) return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });

  const admin = createAdminClient();
  const { data: allRecs } = await admin.from("strategy_recommendations").select("*").eq("review_id", review.id);
  const fields = applyAcceptedRevisions(strategyFieldsFromJson(review.input_fields), allRecs ?? []);

  try {
    const { system, user } = buildCoachPrompt({
      fields,
      fieldLabel: rec.field_label,
      originalAnswer: rec.original_answer,
      issue: rec.issue,
      explanation: rec.explanation,
      currentSuggestion: rec.suggested_answer,
      history: rec.coach_messages.map((m) => ({ role: m.role, text: m.text })),
      mode,
      message,
    });
    const result = await generateStructured(system, user, STRATEGY_COACH_MAX_OUTPUT_TOKENS, {
      name: "coach_reply",
      description: "Reply to the business owner about this one strategy issue.",
      schema: coachReplySchema,
    });
    const reply = result.data;
    const now = new Date().toISOString();
    const userText =
      mode === "why" ? "Why is this better?" : mode === "alternative" ? "Can I see a different alternative?" : message;
    const coachText = reply.suggested_answer
      ? `${reply.reply}\n\nSuggested answer: ${reply.suggested_answer}`
      : reply.reply;
    const messages = [
      ...rec.coach_messages,
      { role: "user" as const, text: userText, at: now },
      { role: "coach" as const, text: coachText, at: now },
    ];

    const { data, error } = await admin
      .from("strategy_recommendations")
      .update({
        coach_messages: messages,
        ...(reply.suggested_answer ? { suggested_answer: reply.suggested_answer } : {}),
        ...(reply.follow_up_question ? { follow_up_question: reply.follow_up_question } : {}),
        updated_at: now,
      })
      .eq("id", recId)
      .select("*")
      .single();
    if (error || !data) throw new Error("Could not save the conversation.");
    await decrementCredits(userId, STRATEGY_COACH_CREDIT_COST);
    return NextResponse.json({ recommendation: data });
  } catch (err) {
    console.error("Strategy coach failed:", err);
    return NextResponse.json({ error: "The coach couldn't answer just now — nothing was charged. Please try again." }, { status: 502 });
  }
}
