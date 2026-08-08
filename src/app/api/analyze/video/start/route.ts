import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails } from "@/lib/credits";
import { PRESENTATION_TYPE_LABELS } from "@/lib/ai/analyzer";
import { VIDEO_ANALYZER_CREDIT_COST } from "@/lib/ai/videoAnalyzer";

export const runtime = "nodejs";

const presentationTypes = Object.keys(PRESENTATION_TYPE_LABELS) as [string, ...string[]];

const requestSchema = z.object({
  projectId: z.string().uuid(),
  presentationType: z.enum(presentationTypes),
});

// Step 1 of the video path: reserve a generation row (and confirm the user can afford it)
// before the browser uploads anything, so the upload has somewhere to go —
// storage path is "{userId}/{generationId}/source.<ext>", enforced by the bucket's RLS policy.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const { projectId, presentationType } = parsed.data;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const guardrail = await checkGuardrails(user.id, VIDEO_ANALYZER_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  const admin = createAdminClient();
  const { data: generation, error: insertError } = await admin
    .from("generations")
    .insert({
      user_id: user.id,
      project_id: projectId,
      asset_type: "presentation_analysis",
      mode: "expert",
      status: "pending",
      credits_charged: VIDEO_ANALYZER_CREDIT_COST,
    })
    .select("id")
    .single();

  if (insertError || !generation) {
    return NextResponse.json({ error: "Could not start analysis." }, { status: 500 });
  }

  return NextResponse.json({
    generationId: generation.id,
    presentationType,
    bucket: "presentation-videos",
    path: `${user.id}/${generation.id}/source`,
  });
}
