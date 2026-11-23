import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeFastActionBonuses, sanitizeStackItems } from "@/lib/stackItems";

export const runtime = "nodejs";

// Auto-saves the offer stack (stack items, bonuses, fast action bonuses — each with its value and
// Value Basis) as the member edits it in Discovery, so a basis is never lost while the rest of
// the form is still in progress. Saves exactly what the member entered: no value is ever changed.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.stack_items) || !Array.isArray(body.fast_action_bonuses)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("projects")
    .update({
      stack_items: sanitizeStackItems(body.stack_items),
      fast_action_bonuses: sanitizeFastActionBonuses(body.fast_action_bonuses),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(`offer-stack autosave failed for project ${id}`, error);
    return NextResponse.json({ error: "Couldn't save your offer stack." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
