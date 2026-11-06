import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedCurrentRecommendation } from "@/lib/strategy/access";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("action", [
  // Accept the suggestion as-is, or with the member's own edits (finalAnswer).
  z.object({ action: z.literal("accept"), finalAnswer: z.string().max(5000).optional() }),
  // Keep the original answer; the decision is recorded, nothing is changed.
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("needs_info"), note: z.string().max(1000).optional() }),
  // Critical claims only: keep the claim out of every generated asset.
  z.object({ action: z.literal("exclude") }),
  // Critical claims only: the member vouches for the claim and says what backs it up.
  z.object({ action: z.literal("attest"), note: z.string().trim().min(5).max(1000) }),
  z.object({ action: z.literal("reset") }),
]);

// Records the member's decision on one recommendation. The original Discovery answer is never
// touched — an accepted revision lives on this row and is applied only when a blueprint is
// approved (and then only inside the blueprint).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ recId: string }> }) {
  const { recId } = await params;
  const owned = await getOwnedCurrentRecommendation(recId);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const { rec } = owned;

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const body = parsed.data;
  const now = new Date().toISOString();
  let update: Record<string, unknown>;

  switch (body.action) {
    case "accept": {
      const answer = (body.finalAnswer ?? rec.suggested_answer).trim();
      if (rec.field_id !== "general" && !answer && rec.original_answer.trim()) {
        return NextResponse.json(
          { error: rec.is_critical ? "There's no rewrite to accept — use “Remove this claim” instead, or write your own version." : "Write an answer first, or keep your original." },
          { status: 400 }
        );
      }
      if (/\[[^\]]+\]/.test(answer)) {
        return NextResponse.json(
          { error: "Fill in the parts in [brackets] with your real details before accepting." },
          { status: 400 }
        );
      }
      update = { approval_status: "accepted", final_answer: answer, decided_at: now };
      break;
    }
    case "reject":
      update = { approval_status: "rejected", final_answer: null, decided_at: now };
      break;
    case "needs_info":
      update = { approval_status: "needs_info", client_note: body.note ?? rec.client_note, decided_at: now };
      break;
    case "exclude":
      if (!rec.is_critical) return NextResponse.json({ error: "Only critical claims can be excluded." }, { status: 400 });
      update = { approval_status: "excluded", final_answer: null, decided_at: now };
      break;
    case "attest":
      if (!rec.is_critical) return NextResponse.json({ error: "Only critical claims need this." }, { status: 400 });
      update = { approval_status: "attested", client_note: body.note, final_answer: null, decided_at: now };
      break;
    case "reset":
      update = { approval_status: "pending", final_answer: null, decided_at: null };
      break;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("strategy_recommendations")
    .update({ ...update, updated_at: now })
    .eq("id", recId)
    .select("*")
    .single();
  if (error || !data) return NextResponse.json({ error: "Could not save that decision." }, { status: 500 });
  return NextResponse.json({ recommendation: data });
}
