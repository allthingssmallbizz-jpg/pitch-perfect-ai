import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateCompleteAsset } from "@/lib/ai/anthropic";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";
import { getBrandVoiceBlock } from "@/lib/ai/brandVoice";
import { getPresenterBioBlock, isPresenterBioIncomplete, getMissingBioFieldLabels } from "@/lib/ai/presenterBio";
import { isRestrictionBypassActive } from "@/lib/adminBypass";
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
  // Course Outline's own per-generation level choice (Basic/Intermediate/Advanced) — loosely
  // validated here since an unrecognized value just falls back to a sensible default inside
  // ASSET_GENERATORS.course_outline's buildPrompt (see courseOutline.ts). Ignored entirely by
  // every other generator.
  courseLevel: z.string().optional(),
  // Course Outline's optional "name it yourself" override — a course title and/or module names
  // the member already picked, used verbatim instead of Cora inventing them. Also ignored
  // entirely by every other generator.
  customNaming: z.string().max(2000).optional(),
  // Build Module Slides' required "which module" input — checked for real below (course_outline
  // must actually contain a module matching this). Ignored by every other generator.
  moduleIdentifier: z.string().max(200).optional(),
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

  const { projectId, assetType, mode, courseLevel, customNaming, moduleIdentifier } = parsed.data as {
    projectId: string;
    assetType: keyof typeof ASSET_GENERATORS;
    mode: GenerationMode;
    courseLevel?: string;
    customNaming?: string;
    moduleIdentifier?: string;
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

  // An admin who's flipped "Remove Restrictions" in /admin (see isRestrictionBypassActive) skips
  // both hard blocks below entirely — every UI-level reminder is dismissible for them already,
  // but without this, clicking Generate would still fail here regardless, since this is the real
  // lock those reminders point at. Never true for a regular member.
  const bypassActive = await isRestrictionBypassActive(user.id);

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
  if (isPresenterBioIncomplete(bio) && !bypassActive) {
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
  if (projectNeedsDiscovery(project) && !bypassActive) {
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

  // Build Module Slides and Module Quiz both need (a) which module to build for, and (b) the
  // FULL text of an already-complete Course Outline to find that module inside — fetched here
  // directly (not through the shared formatPriorGenerationsBlock/priorGenerations mechanism
  // further below, which truncates prior-generation context to 4000 characters; a real
  // multi-module curriculum routinely exceeds that, and truncating it would silently cut off any
  // module past the first one or two).
  const MODULE_SCOPED_PROMPTS: Record<string, { missingModule: string; missingOutline: string }> = {
    course_module_slides: {
      missingModule: "Say which module to build slides for first.",
      missingOutline: "Generate your Course Outline first — Build Module Slides needs the actual course structure to build from.",
    },
    course_module_quiz: {
      missingModule: "Say which module you want a quiz for first.",
      missingOutline: "Generate your Course Outline first — the quiz needs the actual course structure to build from.",
    },
    course_module_workbook: {
      missingModule: "Say which module you want a workbook for first.",
      missingOutline: "Generate your Course Outline first — the workbook needs the actual course structure to build from.",
    },
  };
  let courseOutlineFullContent: string | undefined;
  const moduleScoped = MODULE_SCOPED_PROMPTS[assetType];
  if (moduleScoped) {
    if (!moduleIdentifier?.trim()) {
      return NextResponse.json({ error: moduleScoped.missingModule }, { status: 400 });
    }
    const { data: outline } = await supabase
      .from("generations")
      .select("content")
      .eq("project_id", projectId)
      .eq("asset_type", "course_outline")
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!outline?.content) {
      return NextResponse.json({ error: moduleScoped.missingOutline }, { status: 400 });
    }
    courseOutlineFullContent = outline.content;
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
      // Persisted (not just used transiently to build the prompt) so a module-scoped generation
      // can be labeled with which module it was for later — see Agent Cora's Completed Courses
      // section (0039_course_completed.sql). Null for every other asset type, course_outline
      // included (a course has one outline, not one per module).
      module_identifier: moduleScoped ? moduleIdentifier : null,
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

    const userPrompt = generator.buildPrompt(project, priorGenerations, {
      courseLevel,
      customNaming,
      moduleIdentifier,
      courseOutlineFullContent,
    });

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

    // The real error used to be swallowed here — saved to the row's own `error` column but
    // never actually returned, so every failure looked identical ("Generation failed") whether
    // it was a Claude API refusal, a bad request, a bug in that specific generator's prompt
    // builder, or something else entirely. That made a member-reported "it's not working" for
    // one specific agent impossible to diagnose without direct database access. Anthropic SDK
    // error messages don't carry anything sensitive (rate limits, invalid-request details,
    // content-policy refusals) — safe to show directly instead of guessing blind.
    return NextResponse.json(
      { error: `Generation failed: ${message} You were not charged credits.` },
      { status: 502 }
    );
  }
}
