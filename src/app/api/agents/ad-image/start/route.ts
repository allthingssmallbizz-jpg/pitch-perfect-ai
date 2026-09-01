import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails } from "@/lib/credits";
import { AD_IMAGE_CREDIT_COST } from "@/lib/ai/generators/adImage";
import { projectNeedsDiscovery } from "@/lib/projects";

export const runtime = "nodejs";

const requestSchema = z.object({ projectId: z.string().uuid() });

// Step 1 of Agent Addie's Image Ads flow: reserve a generation row (and confirm the member can
// afford it) before the browser uploads the photo, so the upload has somewhere to go — storage
// path is "{userId}/{generationId}/source.<ext>", enforced by the ad-images bucket's RLS
// policy. Mirrors /api/analyze/video/start's same reasoning for the same reason.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const { projectId } = parsed.data;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Same rule as every other generator (see /api/generate/route.ts) — no agent runs without a
  // complete Discovery brief for this project, enforced here rather than only as a page redirect.
  if (projectNeedsDiscovery(project)) {
    return NextResponse.json(
      { error: "Complete this project's Discovery brief first — every agent needs it before it can generate anything." },
      { status: 400 }
    );
  }

  const guardrail = await checkGuardrails(user.id, AD_IMAGE_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  const admin = createAdminClient();
  const { data: generation, error: insertError } = await admin
    .from("generations")
    .insert({
      user_id: user.id,
      project_id: projectId,
      asset_type: "ad_image",
      mode: "expert",
      status: "pending",
      credits_charged: AD_IMAGE_CREDIT_COST,
    })
    .select("id")
    .single();

  if (insertError || !generation) {
    return NextResponse.json({ error: "Could not start." }, { status: 500 });
  }

  return NextResponse.json({
    generationId: generation.id,
    bucket: "ad-images",
    path: `${user.id}/${generation.id}/source`,
  });
}
