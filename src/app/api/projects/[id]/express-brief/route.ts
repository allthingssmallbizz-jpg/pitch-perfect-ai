import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { coerceExpressDraft } from "@/lib/express";

export const runtime = "nodejs";

// Saves the member's Pitch Perfect Express intake answers on their project (auto-save and the
// Save button), so they survive a failed generation, a reload, or a different device. Drafts may
// be half-finished — only Generate requires every answer.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const draft = coerceExpressDraft(body?.brief);
  if (!draft) return NextResponse.json({ ok: true, saved: false });

  const { data, error } = await supabase
    .from("projects")
    .update({ express_brief: draft })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(`express-brief save failed for project ${id}`, error);
    return NextResponse.json({ error: "Couldn't save your answers to your account." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ ok: true, saved: true });
}
