import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateCompleteAsset } from "@/lib/ai/anthropic";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";
import { getBrandVoiceBlock } from "@/lib/ai/brandVoice";
import { getPresenterBioBlock, isPresenterBioIncomplete, getMissingBioFieldLabels } from "@/lib/ai/presenterBio";
import { stripHtmlCodeFence, WEB_PAGE_ASSET_TYPES, injectFormAction } from "@/lib/ai/generators/htmlPage";
import { ASSET_GENERATORS, ASSET_TYPES } from "@/lib/ai/generators";
import { getFormSubmitUrl } from "@/lib/publishing";
import type { PriorGeneration } from "@/lib/ai/generators/shared";
import { getAgent } from "@/lib/agents/config";
import { recordGenerationVersion } from "@/lib/generations";
import { projectNeedsDiscovery } from "@/lib/projects";
import type { GenerationMode } from "@/types/database";

export const runtime = "nodejs";
// Without this, the function is bound by the hosting plan's default timeout — on Vercel's free
// Hobby tier that's a low default (configurable up to 60s max on Hobby; this route's real need
// can exceed that once generateCompleteAsset chains multiple Claude calls back-to-back for a
// long-form generator like the 60-90 slide PPT outline). If the platform kills the function
// mid-generation, the row is stuck at "pending" forever — never complete, never failed —
// which looks exactly like "it wrote nothing" and "it's not saving past generations" at once,
// since a stuck-pending row never shows up anywhere. 300s only actually applies on a plan that
// allows it (Vercel Pro or above); see the admin panel's reminder about this.
export const maxDuration = 300;

const requestSchema = z.object({
  projectId: z.string().uuid(),
  assetType: z.enum(ASSET_TYPES as [string, ...string[]]),
  mode: z.enum(["coach", "expert"] as const),
});

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
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { projectId, assetType, mode } = parsed.data as {
    projectId: string;
    assetType: keyof typeof ASSET_GENERATORS;
    mode: GenerationMode;
  };

  const generator = ASSET_GENERATORS[assetType];

  // The project must belong to this user (RLS on the user-scoped client enforces this too,
  // but we look it up explicitly here since generation below runs on the admin client).
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Bio comes before Discovery, and neither is optional — a strong presenter bio is what turns
  // generic Credibility Bridge / Opening Story beats into the presenter's real story (see
  // getPresenterBioBlock below), and skipping it isn't a shortcut worth allowing. Checked against
  // THIS project's linked niche (presenter_bio_profile_id — see 0031_niche_bio_profiles.sql), not
  // just "does this account have any bio anywhere," since an account can hold several niches and
  // only the one this project actually points at matters here. Same real lock as the Discovery
  // check just below: the generate page already redirects a fresh visit to /bio first, but that's
  // a UI nudge, not a lock — this is the one nothing can slip past.
  const { data: bio } = project.presenter_bio_profile_id
    ? await supabase.from("presenter_bio_profiles").select("*").eq("id", project.presenter_bio_profile_id).maybeSingle()
    : { data: null };
  if (isPresenterBioIncomplete(bio)) {
    const missing = getMissingBioFieldLabels(bio);
    return NextResponse.json(
      { error: `Finish this project's niche bio first — still missing: ${missing.join(", ")}. Every agent needs it to write a strong, credible presentation.` },
      { status: 400 }
    );
  }

  // No agent generates without a complete Discovery brief for this project — every prompt builder
  // reads from it (see formatDiscoveryBlock), and a member with a blank/partial brief generating
  // anyway just gets vague, generic output with no clue why. The generate page already redirects
  // a fresh visit to Discovery first (projectNeedsDiscovery, src/app/(app)/projects/[id]/generate/
  // [assetType]/page.tsx), but that's a UI nudge, not a lock — this is the real one, so there's no
  // path (a stale tab, a direct API call, a chained-generation button firing after the brief was
  // edited back to incomplete) that can slip a generation through without it.
  if (projectNeedsDiscovery(project)) {
    return NextResponse.json(
      { error: "Complete this project's Discovery brief first — every agent needs it before it can generate anything." },
      { status: 400 }
    );
  }

  // A Webinar Script writes the talk-track for an existing slide deck, aligned 1:1 to its exact
  // slide numbers/titles (see buildWebinarScriptPrompt) — there's nothing to align to without one.
  // Checked here, before the pending row is even inserted, so this reads as a normal validation
  // error instead of a wasted Claude call that gets caught and reported as a generic "Generation
  // failed" (the catch block below never surfaces its specific error message to the client, only
  // to the generations row's own `error` column).
  if (assetType === "webinar_script") {
    const { data: deck } = await supabase
      .from("generations")
      .select("id")
      .eq("project_id", projectId)
      .eq("asset_type", "ppt_outline")
      .eq("status", "complete")
      .limit(1)
      .maybeSingle();
    if (!deck) {
      return NextResponse.json(
        { error: "Generate Your Signature Webinar (the slide deck) first — the script needs your actual slides to write from." },
        { status: 400 }
      );
    }
  }

  const guardrail = await checkGuardrails(user.id, generator.creditCost);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  const admin = createAdminClient();

  const { data: pendingGeneration } = await admin
    .from("generations")
    .insert({
      user_id: user.id,
      project_id: projectId,
      asset_type: assetType,
      mode,
      status: "pending",
      credits_charged: generator.creditCost,
    })
    .select("id")
    .single();

  if (!pendingGeneration) {
    return NextResponse.json({ error: "Could not start generation." }, { status: 500 });
  }
  const generationId = pendingGeneration.id;

  try {
    const brandVoiceBlock = await getBrandVoiceBlock(supabase, user.id);
    const presenterBioBlock = await getPresenterBioBlock(supabase, project.presenter_bio_profile_id);
    const agentPersona = getAgent(assetType)?.personaInstructions;
    const systemPrompt = buildSystemPrompt(mode, brandVoiceBlock, agentPersona, presenterBioBlock);

    // So every generator can stay consistent with whatever's already been built for this
    // project (same Big Idea, headline, offer framing — see formatPriorGenerationsBlock) instead
    // of each one independently reinventing its own narrative from the discovery facts alone.
    // Only the most recent completed generation per asset type is used, and the asset type being
    // generated right now is excluded (nothing to be "consistent with" against itself).
    const { data: priorRows } = await supabase
      .from("generations")
      .select("asset_type, content")
      .eq("project_id", projectId)
      .eq("status", "complete")
      .neq("asset_type", assetType)
      .in("asset_type", ASSET_TYPES)
      .not("content", "is", null)
      .order("created_at", { ascending: false });

    const seenAssetTypes = new Set<string>();
    const priorGenerations: PriorGeneration[] = [];
    for (const row of priorRows ?? []) {
      if (seenAssetTypes.has(row.asset_type)) continue;
      seenAssetTypes.add(row.asset_type);
      priorGenerations.push({ assetType: row.asset_type, content: row.content! });
    }

    const userPrompt = generator.buildPrompt(project, priorGenerations);

    const result = await generateCompleteAsset(
      systemPrompt,
      userPrompt,
      generator.maxOutputTokens,
      undefined,
      undefined,
      generator.isOutputIncomplete,
      generator.continuationHint
    );

    // Landing Page and Thank You Page both output a real HTML document, not markdown — strip a
    // stray code fence defensively in case Claude wraps it in one despite the explicit instruction
    // not to (same pattern as parseRatedHeadlines in headlineLab.ts).
    let finalContent = WEB_PAGE_ASSET_TYPES.includes(assetType) ? stripHtmlCodeFence(result.content) : result.content;

    // Only Landing Page's prompt writes the FORM_ACTION_PLACEHOLDER (its opt-in form) — swap it
    // for the real, generation-specific submission URL now that generationId exists. This is what
    // makes the form actually submit somewhere (straight into the member's Go High Level account,
    // if connected) with zero manual wiring on their end.
    if (assetType === "landing_page") {
      finalContent = injectFormAction(finalContent, getFormSubmitUrl(generationId));
    }

    const { error: updateError } = await admin
      .from("generations")
      .update({
        status: "complete",
        content: finalContent,
        model: result.model,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        cost_usd: result.costUsd,
      })
      .eq("id", generationId);
    // Generation succeeded but persisting it failed — surface this loudly (throw into the
    // catch block below) instead of returning content the user can see on screen right now but
    // that silently isn't actually saved, which is worse than an honest error.
    if (updateError) throw new Error(`Generated successfully but could not save: ${updateError.message}`);

    await recordGenerationVersion(generationId, user.id, finalContent, "generate", "Generated draft");
    await decrementCredits(user.id, generator.creditCost);

    return NextResponse.json({
      generationId,
      content: finalContent,
      creditsCharged: generator.creditCost,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await admin.from("generations").update({ status: "failed", error: message }).eq("id", generationId);

    return NextResponse.json({ error: "Generation failed. You were not charged credits." }, { status: 502 });
  }
}
