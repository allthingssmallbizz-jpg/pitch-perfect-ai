import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails } from "@/lib/credits";
import { PRESENTATION_TYPE_LABELS } from "@/lib/ai/analyzer";
import { VIDEO_ANALYZER_CREDIT_COST } from "@/lib/ai/videoAnalyzer";
import { runVideoAnalysisPipeline } from "@/lib/video/pipeline";
import type { PresentationType } from "@/types/database";

export const runtime = "nodejs";
// Transcription + frame extraction + analysis for a long video won't fit in a default
// serverless timeout. This ceiling requires a plan that supports it (e.g. Vercel Pro) —
// on a plan capped lower, `after()` is cut off mid-pipeline and the generation is left
// stuck in a non-terminal status rather than marked "failed".
export const maxDuration = 300;

const presentationTypes = Object.keys(PRESENTATION_TYPE_LABELS) as [string, ...string[]];

const requestSchema = z.object({
  generationId: z.string().uuid(),
  presentationType: z.enum(presentationTypes),
});

// Step 2 of the video path: called once the browser has finished uploading the file directly
// to Storage. Validates ownership + re-checks guardrails, marks the generation "uploaded", then
// hands off to the background pipeline via `after()` and responds immediately — the browser
// polls the generations row directly for progress instead of holding this request open.
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
  const { generationId, presentationType } = parsed.data as {
    generationId: string;
    presentationType: PresentationType;
  };

  const admin = createAdminClient();
  const { data: generation } = await admin
    .from("generations")
    .select("id, user_id, status")
    .eq("id", generationId)
    .single();

  if (!generation || generation.user_id !== user.id) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }
  if (generation.status !== "pending") {
    return NextResponse.json({ error: "This analysis has already been started." }, { status: 409 });
  }

  const guardrail = await checkGuardrails(user.id, VIDEO_ANALYZER_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  const { data: files, error: listError } = await admin.storage
    .from("presentation-videos")
    .list(`${user.id}/${generationId}`);
  const uploadedFile = files?.find((f) => f.name.startsWith("source"));
  if (listError || !uploadedFile) {
    return NextResponse.json({ error: "No uploaded video found for this analysis." }, { status: 400 });
  }
  const fullVideoPath = `${user.id}/${generationId}/${uploadedFile.name}`;

  await admin
    .from("generations")
    .update({ status: "uploaded", video_path: fullVideoPath, progress_message: "Starting analysis..." })
    .eq("id", generationId);

  after(() =>
    runVideoAnalysisPipeline({
      generationId,
      userId: user.id,
      presentationType,
      videoPath: fullVideoPath,
    })
  );

  return NextResponse.json({ generationId, status: "uploaded" });
}
