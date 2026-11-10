import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateCompleteAsset, type GenerateEffort, type GenerateResult } from "@/lib/ai/anthropic";
import {
  isWebinarScriptSectionIncomplete,
  planWebinarScriptSections,
  splitSlidesIntoSections,
  trimScriptToSection,
  webinarScriptSectionContinuationHint,
  WEBINAR_SCRIPT_SECTION_MAX_OUTPUT_TOKENS,
  WEBINAR_SCRIPT_SECTION_EFFORT,
  type WebinarScriptRange,
} from "@/lib/ai/generators/webinarScript";
import {
  buildPptOutlinePlanPrompt,
  buildPptOutlineSectionPrompt,
  isPptOutlinePlanIncomplete,
  parsePptOutlinePlan,
  pptOutlineSectionContinuationHint,
  PPT_OUTLINE_PLAN_CONTINUATION_HINT,
  PPT_OUTLINE_PLAN_MAX_OUTPUT_TOKENS,
  PPT_OUTLINE_PLAN_EFFORT,
  PPT_OUTLINE_SECTION_EFFORT,
  PPT_OUTLINE_SECTION_MAX_OUTPUT_TOKENS,
  PPT_OUTLINE_SLIDES_PER_SECTION,
  PPT_OUTLINE_MIN_ACCEPTABLE_SLIDES,
} from "@/lib/ai/generators/pptOutline";

// Sectioned generations (Webinar Script, Your Signature Webinar deck) stop themselves this long
// after the request began — comfortably inside maxDuration below — so a slow run fails with a
// specific, readable reason instead of being cut off by the platform with no trace.
const SECTION_BUDGET_MS = 270 * 1000;
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
import { parseChallengeDayList } from "@/lib/ai/challengeDays";
import type { GenerationMode } from "@/types/database";
import { getCurrentBlueprint } from "@/lib/strategy/server";
import { applyApprovedFields } from "@/lib/strategy/fields";
import { formatStrategyBlueprintBlock, type Blueprint } from "@/lib/strategy/blueprint";
import { STRATEGY_GATED_ASSET_TYPES } from "@/lib/strategy/schema";

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
  // Webinar Script only — the exact ppt_outline generation to write a script for (the deck a
  // member actually has open), resolved below instead of implicitly "whichever deck is most
  // recent for this project." Omitted means that old implicit behavior, for backward
  // compatibility with any caller that doesn't pass it. Ignored by every other generator.
  sourceGenerationId: z.string().uuid().optional(),
  // Challenge Outline's own per-generation length choice (3 or 5 days) — loosely validated here
  // the same way courseLevel is, since an unrecognized value just falls back to a sensible
  // default inside ASSET_GENERATORS.challenge_outline's buildPrompt. Ignored by every other
  // generator.
  challengeLength: z.string().optional(),
  // Build Day Slides' required "which day" input — checked for real below (the challenge outline
  // must actually contain a day matching this). Ignored by every other generator.
  dayIdentifier: z.string().max(200).optional(),
  // Build Day Slides only — whether THIS day's deck should include the pitch/offer slides (see
  // challengeDaySlides.ts). Ignored by every other generator.
  includePitch: z.boolean().optional(),
  // Presentation agents only: the member explicitly chose to generate without an approved
  // Strategy Review (see STRATEGY_GATED_ASSET_TYPES). Without it, those agents ask for a review first.
  skipStrategyReview: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const requestStartedAt = Date.now();
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

  const { projectId, assetType, mode, courseLevel, customNaming, moduleIdentifier, sourceGenerationId, challengeLength, dayIdentifier, includePitch, skipStrategyReview } =
    parsed.data as {
      projectId: string;
      assetType: keyof typeof ASSET_GENERATORS;
      mode: GenerationMode;
      courseLevel?: string;
      customNaming?: string;
      moduleIdentifier?: string;
      sourceGenerationId?: string;
      challengeLength?: string;
      dayIdentifier?: string;
      includePitch?: boolean;
      skipStrategyReview?: boolean;
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

  // Strategy Review checkpoint. When the member has an approved Strategy Blueprint, every agent
  // generates from it: its frozen, approved answers replace the live Discovery answers (so later
  // Discovery edits can't silently change an approved strategy), and its framework/claim rules are
  // appended to the prompt. Presentation agents without an approved blueprint stop and ask for a
  // review unless the member explicitly chose to continue without one.
  const strategyBlueprint = await getCurrentBlueprint(supabase, projectId);
  if (
    !strategyBlueprint &&
    (STRATEGY_GATED_ASSET_TYPES as readonly string[]).includes(assetType) &&
    !skipStrategyReview &&
    !bypassActive &&
    // Demo mode (example data, see 0052_demo_mode.sql) never stops for the review — the point is
    // to show what a finished presentation looks like, and every output is labeled Demo.
    !project.is_demo
  ) {
    return NextResponse.json(
      {
        error: "Review and approve your strategy first, or choose to generate without a review.",
        code: "strategy_review_required",
      },
      { status: 409 }
    );
  }
  const promptProject = strategyBlueprint ? applyApprovedFields(project, strategyBlueprint.approved_fields) : project;

  // A Webinar Script writes the talk-track for an existing slide deck, aligned 1:1 to its exact
  // slide numbers/titles (see buildWebinarScriptPrompt) — there's nothing to align to without one.
  // Resolved explicitly to a single {id, content} here — via sourceGenerationId when a member is
  // viewing a specific past deck version and wants a script attached to exactly that one (see
  // 0043_webinar_script_source.sql), falling back to whichever deck is most recent for this
  // project otherwise — rather than leaving "which deck" implicit inside the generic
  // priorGenerations lookup further below, which only ever meant "the most recent," silently
  // wrong once a project has more than one deck version. Checked here, before the pending row is
  // even inserted, so a missing/invalid deck reads as a normal validation error instead of a
  // wasted Claude call that gets caught and reported as a generic "Generation failed."
  let webinarScriptSourceDeck: { id: string; content: string } | undefined;
  if (assetType === "webinar_script") {
    if (sourceGenerationId) {
      const { data: deck } = await supabase
        .from("generations")
        .select("id, content")
        .eq("id", sourceGenerationId)
        .eq("project_id", projectId)
        .eq("asset_type", "ppt_outline")
        .eq("status", "complete")
        .maybeSingle();
      if (!deck?.content) {
        return NextResponse.json({ error: "Couldn't find that specific deck to write a script for." }, { status: 404 });
      }
      webinarScriptSourceDeck = { id: deck.id, content: deck.content };
    } else {
      const { data: deck } = await supabase
        .from("generations")
        .select("id, content")
        .eq("project_id", projectId)
        .eq("asset_type", "ppt_outline")
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!deck?.content) {
        return NextResponse.json(
          { error: "Generate Your Signature Webinar (the slide deck) first — the script needs your actual slides to write from." },
          { status: 400 }
        );
      }
      webinarScriptSourceDeck = { id: deck.id, content: deck.content };
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

  // Build Day Slides needs (a) which day to build for, and (b) the FULL text of an already-
  // complete Challenge Outline to find that day inside — same reasoning as the module-scoped
  // block above, kept separate since the source asset type and error copy both differ.
  let challengeOutlineFullContent: string | undefined;
  let isFinalDay = false;
  if (assetType === "challenge_day_slides") {
    if (!dayIdentifier?.trim()) {
      return NextResponse.json({ error: "Say which day to build slides for first." }, { status: 400 });
    }
    const { data: outline } = await supabase
      .from("generations")
      .select("content")
      .eq("project_id", projectId)
      .eq("asset_type", "challenge_outline")
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!outline?.content) {
      return NextResponse.json(
        { error: "Generate your Challenge Outline first — Build Challenge Day Slides needs the actual challenge structure to build from." },
        { status: 400 }
      );
    }
    challengeOutlineFullContent = outline.content;
    const days = parseChallengeDayList(outline.content);
    const dayNumber = Number(dayIdentifier.match(/day\s+(\d+)/i)?.[1]);
    const maxDay = days.length ? Math.max(...days.map((d) => d.number)) : undefined;
    isFinalDay = Number.isFinite(dayNumber) && dayNumber === maxDay;
  }

  // Persist whatever's currently in the "name the course/modules yourself" box back onto the
  // project itself — a course's own name is routinely different from whatever webinar/offer it's
  // based on, and retyping it on every single Regenerate (the previous behavior) was the reported
  // problem this fixes. Best-effort: a failed save here shouldn't block the actual generation the
  // member is waiting on, and it's harmless to just try again next time. See
  // 0040_course_naming.sql and GenerateClient.tsx's customNaming state.
  if (assetType === "course_outline") {
    const { error: namingError } = await supabase
      .from("projects")
      .update({ course_naming: customNaming ?? "" })
      .eq("id", projectId)
      .eq("user_id", user.id);
    if (namingError) console.error("generate: failed to persist course_naming", namingError);
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
      // Only written when true, so generating never depends on 0052_demo_mode.sql having run.
      ...(project.is_demo ? { is_demo: true } : {}),
      // Persisted (not just used transiently to build the prompt) so a module-scoped generation
      // can be labeled with which module it was for later — see Agent Cora's Completed Courses
      // section (0039_course_completed.sql). Null for every other asset type, course_outline
      // included (a course has one outline, not one per module). Build Day Slides reuses this
      // same column for which day it was built for, rather than a second dedicated column — it's
      // already a generic "which sub-unit was this for" field, and every existing consumer
      // (Past generations list, VersionHistory) already just displays it as-is.
      module_identifier: moduleScoped ? moduleIdentifier : assetType === "challenge_day_slides" ? dayIdentifier : null,
      // Persists exactly which ppt_outline deck this script was written for (see
      // 0043_webinar_script_source.sql) — always recorded, even when sourceGenerationId wasn't
      // explicitly passed, so every future consumer (export, Copy for Gamma, the slide preview)
      // can match a script back to its real deck instead of guessing "whichever is most recent."
      source_generation_id: assetType === "webinar_script" ? webinarScriptSourceDeck?.id ?? null : null,
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

    const generatorExtra = {
      courseLevel,
      customNaming,
      moduleIdentifier,
      courseOutlineFullContent,
      sourceDeckContent: webinarScriptSourceDeck?.content,
      challengeLength,
      dayIdentifier,
      challengeOutlineFullContent,
      includePitch,
      isFinalDay,
    };
    const blueprintSuffix = strategyBlueprint
      ? `\n${formatStrategyBlueprintBlock(
          strategyBlueprint.blueprint as Blueprint,
          strategyBlueprint.blueprint_version,
          strategyBlueprint.approved_at
        )}`
      : "";
    const userPrompt = generator.buildPrompt(promptProject, priorGenerations, generatorExtra) + blueprintSuffix;

    // Threaded through explicitly (not just `generator.isOutputIncomplete` by itself) so a check
    // like Challenge Outline's own — "did this actually produce the number of days that was
    // REQUESTED" — can see that request (generatorExtra.challengeLength) instead of only the
    // generated content. See isChallengeOutlineIncomplete's own comment for the real failure
    // (a 5-day request coming back with only 4 days) this exists to catch.
    // A long deck's script is written in parallel sections and joined in order — one request for
    // the whole thing can outrun the 300-second limit above and leave the generation stuck. See
    // planWebinarScriptSections.
    const scriptSections =
      assetType === "webinar_script" && webinarScriptSourceDeck
        ? planWebinarScriptSections(webinarScriptSourceDeck.content)
        : [];
    // Writes each section in parallel and joins them in order, all inside SECTION_BUDGET_MS.
    // `startedAt` is when this generation's own AI work began (the deck's plan call counts).
    const writeSections = async (
      label: string,
      sections: WebinarScriptRange[],
      sectionMaxTokens: number,
      buildSectionPrompt: (range: WebinarScriptRange) => string,
      isSectionIncomplete: (content: string, range: WebinarScriptRange) => boolean,
      sectionHint: (range: WebinarScriptRange) => string,
      signal: AbortSignal,
      startedAt: number,
      effort: GenerateEffort
    ): Promise<GenerateResult> => {
      const status = sections.map((range) => ({ range, done: false, seconds: 0, slides: 0, outputTokens: 0 }));
      let parts: GenerateResult[];
      try {
        parts = await Promise.all(
          sections.map(async (range, i) => {
            const part = await generateCompleteAsset(
              systemPrompt,
              buildSectionPrompt(range),
              sectionMaxTokens,
              undefined,
              1,
              (content) => isSectionIncomplete(content, range),
              sectionHint(range),
              signal,
              effort
            );
            const trimmed = trimScriptToSection(part.content, range);
            status[i] = {
              range,
              done: true,
              seconds: Math.round((Date.now() - startedAt) / 1000),
              slides: trimmed ? trimmed.split(/\n(?=#{0,4}\s*\*{0,2}\s*slide\s+\d+)/i).length : 0,
              outputTokens: part.outputTokens,
            };
            console.log(
              `[${assetType} ${generationId}] section ${range.part}/${range.parts} done in ${status[i].seconds}s — ${part.outputTokens} output tokens`
            );
            return { ...part, content: trimmed };
          })
        );
      } catch (err) {
        // Say exactly how far it got, so a slow or failed run can actually be diagnosed.
        const summary = status
          .map((s) =>
            s.done
              ? `part ${s.range.part} finished in ${s.seconds}s (${s.slides} of ${s.range.count} slides, ${s.outputTokens} tokens)`
              : `part ${s.range.part} (slides ${s.range.first.number}-${s.range.last.number}) unfinished`
          )
          .join("; ");
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        const reason = signal.aborted
          ? `The ${label} took longer than allowed (${elapsed}s) and was stopped`
          : `The ${label} stopped with an error after ${elapsed}s (${err instanceof Error ? err.message : "unknown error"})`;
        console.error(`[${assetType} ${generationId}] ${reason}: ${summary}`);
        throw new Error(`${reason} — please try again. Details: ${summary}.`);
      }
      return {
        content: parts.map((p) => p.content.trim()).join("\n\n"),
        model: parts[0].model,
        inputTokens: parts.reduce((sum, p) => sum + p.inputTokens, 0),
        outputTokens: parts.reduce((sum, p) => sum + p.outputTokens, 0),
        costUsd: parts.reduce((sum, p) => sum + p.costUsd, 0),
        stopReason: parts[parts.length - 1].stopReason,
      };
    };

    const sectioned = scriptSections.length > 1 || assetType === "ppt_outline";
    const abort = new AbortController();
    const timer = sectioned
      ? setTimeout(() => abort.abort(), Math.max(SECTION_BUDGET_MS - (Date.now() - requestStartedAt), 30 * 1000))
      : undefined;
    let result: GenerateResult;
    try {
      if (scriptSections.length > 1) {
        result = await writeSections(
          "script",
          scriptSections,
          WEBINAR_SCRIPT_SECTION_MAX_OUTPUT_TOKENS,
          (range) =>
            generator.buildPrompt(promptProject, priorGenerations, { ...generatorExtra, scriptRange: range }) + blueprintSuffix,
          isWebinarScriptSectionIncomplete,
          webinarScriptSectionContinuationHint,
          abort.signal,
          Date.now(),
          WEBINAR_SCRIPT_SECTION_EFFORT
        );
      } else if (assetType === "ppt_outline") {
        // The deck in one request regularly outran the 300-second limit (see the comment above
        // PPT_OUTLINE_SLIDES_PER_SECTION). Plan the slides first, then write them in parallel.
        const deckStartedAt = Date.now();
        const buildWholeDeck = () =>
          generateCompleteAsset(
            systemPrompt,
            userPrompt,
            generator.maxOutputTokens,
            undefined,
            undefined,
            (content) => generator.isOutputIncomplete?.(content, generatorExtra) ?? false,
            generator.continuationHint,
            undefined,
            PPT_OUTLINE_SECTION_EFFORT
          );
        // A plan that can't be used must never block the deck: a reported real run got back a
        // plan with no slides in it at all, twice, and every member's deck failed with it. In that
        // case the deck is written in one request exactly as it was before sectioning existed —
        // fine for most decks, and only the very longest can still run out of time.
        let plan: GenerateResult | null = null;
        try {
          plan = await generateCompleteAsset(
            systemPrompt,
            buildPptOutlinePlanPrompt(promptProject, priorGenerations, blueprintSuffix),
            PPT_OUTLINE_PLAN_MAX_OUTPUT_TOKENS,
            undefined,
            1,
            isPptOutlinePlanIncomplete,
            PPT_OUTLINE_PLAN_CONTINUATION_HINT,
            abort.signal,
            PPT_OUTLINE_PLAN_EFFORT
          );
        } catch (err) {
          console.error(
            `[ppt_outline ${generationId}] plan failed after ${Math.round((Date.now() - deckStartedAt) / 1000)}s (${err instanceof Error ? err.message : "unknown error"}) — writing the deck in one request instead`
          );
        }
        const planSlides = plan ? parsePptOutlinePlan(plan.content) : [];
        const deckSections =
          planSlides.length >= PPT_OUTLINE_MIN_ACCEPTABLE_SLIDES
            ? splitSlidesIntoSections(planSlides, PPT_OUTLINE_SLIDES_PER_SECTION)
            : [];
        if (plan) {
          console.log(
            `[ppt_outline ${generationId}] plan done in ${Math.round((Date.now() - deckStartedAt) / 1000)}s — ${planSlides.length} slides, ${plan.outputTokens} output tokens, stop: ${plan.stopReason}`
          );
        }
        if (!plan || deckSections.length < 2) {
          if (plan) {
            console.error(
              `[ppt_outline ${generationId}] plan unusable (${planSlides.length} slides) — writing the deck in one request instead; it began: ${JSON.stringify(plan.content.slice(0, 600))}`
            );
          }
          const whole = await buildWholeDeck();
          result = plan
            ? {
                ...whole,
                inputTokens: whole.inputTokens + plan.inputTokens,
                outputTokens: whole.outputTokens + plan.outputTokens,
                costUsd: whole.costUsd + plan.costUsd,
              }
            : whole;
        } else {
          const planContent = plan.content;
          const deck = await writeSections(
            "deck",
            deckSections,
            PPT_OUTLINE_SECTION_MAX_OUTPUT_TOKENS,
            (range) => buildPptOutlineSectionPrompt(promptProject, priorGenerations, planContent, range, blueprintSuffix),
            isWebinarScriptSectionIncomplete,
            pptOutlineSectionContinuationHint,
            abort.signal,
            deckStartedAt,
            PPT_OUTLINE_SECTION_EFFORT
          );
          result = {
            ...deck,
            inputTokens: deck.inputTokens + plan.inputTokens,
            outputTokens: deck.outputTokens + plan.outputTokens,
            costUsd: deck.costUsd + plan.costUsd,
          };
        }
      } else {
        result = await generateCompleteAsset(
          systemPrompt,
          userPrompt,
          generator.maxOutputTokens,
          undefined,
          undefined,
          (content) => generator.isOutputIncomplete?.(content, generatorExtra) ?? false,
          generator.continuationHint
        );
      }
    } finally {
      clearTimeout(timer);
    }

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
    if (strategyBlueprint) {
      await admin
        .from("strategy_blueprints")
        .update({ generation_status: "generated", last_generated_at: new Date().toISOString() })
        .eq("id", strategyBlueprint.id);
    }

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
