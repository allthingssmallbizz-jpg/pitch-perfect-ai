import type { AssetType, Project } from "@/types/database";
import type { PriorGeneration } from "./shared";
import { buildWebinarOutlinePrompt, WEBINAR_CREDIT_COST, WEBINAR_MAX_OUTPUT_TOKENS } from "./webinarOutline";
import { buildVslScriptPrompt, VSL_CREDIT_COST, VSL_MAX_OUTPUT_TOKENS } from "./vslScript";
import { buildSalesPagePrompt, SALES_PAGE_CREDIT_COST, SALES_PAGE_MAX_OUTPUT_TOKENS } from "./salesPage";
import { buildLandingPagePrompt, LANDING_PAGE_CREDIT_COST, LANDING_PAGE_MAX_OUTPUT_TOKENS } from "./landingPage";
import { buildEmailSequencePrompt, EMAIL_SEQUENCE_CREDIT_COST, EMAIL_SEQUENCE_MAX_OUTPUT_TOKENS } from "./emailSequence";
import {
  buildPptOutlinePrompt,
  PPT_OUTLINE_CREDIT_COST,
  PPT_OUTLINE_MAX_OUTPUT_TOKENS,
  isPptOutlineIncomplete,
  PPT_OUTLINE_CONTINUATION_HINT,
} from "./pptOutline";
import { buildAdCopyPrompt, AD_COPY_CREDIT_COST, AD_COPY_MAX_OUTPUT_TOKENS } from "./adCopy";
import { buildOfferLadderPrompt, OFFER_LADDER_CREDIT_COST, OFFER_LADDER_MAX_OUTPUT_TOKENS } from "./offerLadder";
import { buildThankYouPagePrompt, THANK_YOU_PAGE_CREDIT_COST, THANK_YOU_PAGE_MAX_OUTPUT_TOKENS } from "./thankYouPage";
import { buildChallengeOutlinePrompt, CHALLENGE_CREDIT_COST, CHALLENGE_MAX_OUTPUT_TOKENS } from "./challengeOutline";
import {
  buildWebinarScriptPrompt,
  WEBINAR_SCRIPT_CREDIT_COST,
  WEBINAR_SCRIPT_MAX_OUTPUT_TOKENS,
  isWebinarScriptIncomplete,
  WEBINAR_SCRIPT_CONTINUATION_HINT,
} from "./webinarScript";
import {
  buildCourseOutlinePrompt,
  COURSE_OUTLINE_CREDIT_COST,
  COURSE_OUTLINE_MAX_OUTPUT_TOKENS,
  isCourseLevel,
} from "./courseOutline";
import {
  buildCourseModuleSlidesPrompt,
  COURSE_MODULE_SLIDES_CREDIT_COST,
  COURSE_MODULE_SLIDES_MAX_OUTPUT_TOKENS,
  isCourseModuleSlidesIncomplete,
  COURSE_MODULE_SLIDES_CONTINUATION_HINT,
} from "./courseModuleSlides";
import { buildCourseModuleQuizPrompt, COURSE_MODULE_QUIZ_CREDIT_COST, COURSE_MODULE_QUIZ_MAX_OUTPUT_TOKENS } from "./courseModuleQuiz";
import {
  buildCourseModuleWorkbookPrompt,
  COURSE_MODULE_WORKBOOK_CREDIT_COST,
  COURSE_MODULE_WORKBOOK_MAX_OUTPUT_TOKENS,
} from "./courseModuleWorkbook";
export { WEB_PAGE_ASSET_TYPES } from "./htmlPage";
export { COURSE_LEVELS, isCourseLevel, type CourseLevel } from "./courseOutline";

// Excludes "presentation_analysis" and "headline_lab" — neither is driven by a project's
// discovery fields (their input is pasted content / a topic brief), so they aren't part
// of this registry. See src/lib/ai/analyzer.ts, src/lib/ai/headlineLab.ts, and
// src/lib/ai/assetLabels.ts. Also excludes "ad_image" — Agent Addie's Image Ads is a
// sub-capability reached from her /agents/ad_copy landing page, not a standalone
// long-form-markdown generator with its own registry entry; see src/lib/ai/generators/adImage.ts.
// "website_import", "tts_narration", "discovery_assist", "offer_builder", "brand_color_surprise",
// and "ihelp_builder" are all lightweight utility calls with no dedicated generator/agent of
// their own — see src/lib/ai/websiteImport.ts, src/lib/ai/offerBuilder.ts,
// src/lib/ai/brandColorPalette.ts, and src/lib/ai/ihelpBuilder.ts. "social_compare" is a
// sub-capability of Agent Annie's presentation analysis, not a discovery-driven generator — see
// src/lib/ai/socialCompare.ts.
export type GeneratorAssetType = Exclude<
  AssetType,
  | "presentation_analysis"
  | "headline_lab"
  | "tts_narration"
  | "discovery_assist"
  | "ad_image"
  | "website_import"
  | "social_compare"
  | "offer_builder"
  | "brand_color_surprise"
  | "ihelp_builder"
>;

// Every generator's buildPrompt shares this same (project, priorGenerations) shape except:
// - Course Outline, which also takes a per-generation level choice (Basic/Intermediate/Advanced)
//   and an optional custom-naming override (a course title and/or module names the member
//   already picked — see courseOutline.ts) — neither is a permanent fact about the project the
//   way discovery fields are, since a member may reasonably want differently-named/leveled
//   versions of the same course.
// - Build Module Slides, which needs the FULL text of an existing Course Outline (not the
//   truncated, generic priorGenerations context every other generator shares — see the dedicated
//   fetch in the API route) plus which module to build slides for.
// Declared as a generic optional third param rather than a parallel interface so every other
// generator's existing (project, prior) => string function stays valid here unchanged.
type BuildPromptExtra = {
  courseLevel?: string;
  customNaming?: string;
  moduleIdentifier?: string;
  courseOutlineFullContent?: string;
  // Webinar Script only — the exact ppt_outline generation's content to write a script for,
  // resolved explicitly by route.ts from a member-specified sourceGenerationId (see
  // 0043_webinar_script_source.sql) rather than implicitly "whichever deck is most recent."
  sourceDeckContent?: string;
};

export interface AssetGenerator {
  assetType: GeneratorAssetType;
  label: string;
  description: string;
  creditCost: number;
  maxOutputTokens: number;
  buildPrompt: (project: Project, priorGenerations: PriorGeneration[], extra?: BuildPromptExtra) => string;
  // Optional extra completeness check passed through to generateCompleteAsset (anthropic.ts) —
  // for a generator with a hard, checkable length requirement the prompt alone can't reliably
  // enforce (PPT Outline's 60-90 slides), this catches Claude stopping on its own well short of
  // that instead of only catching a hard max_tokens cutoff. Most generators don't need this.
  isOutputIncomplete?: (content: string) => boolean;
  continuationHint?: string;
}

export const ASSET_GENERATORS: Record<GeneratorAssetType, AssetGenerator> = {
  webinar_outline: {
    assetType: "webinar_outline",
    label: "Webinar Blueprint",
    description: "Full PPWOS™ 7-phase webinar strategy — the plan Your Signature Webinar (PPT Outline) builds slides from.",
    creditCost: WEBINAR_CREDIT_COST,
    maxOutputTokens: WEBINAR_MAX_OUTPUT_TOKENS,
    buildPrompt: buildWebinarOutlinePrompt,
  },
  vsl_script: {
    assetType: "vsl_script",
    label: "VSL Script",
    description: "25-part video sales letter script, word-for-word.",
    creditCost: VSL_CREDIT_COST,
    maxOutputTokens: VSL_MAX_OUTPUT_TOKENS,
    buildPrompt: buildVslScriptPrompt,
  },
  sales_page: {
    assetType: "sales_page",
    label: "Sales Page",
    description: "Full long-form sales page copy, section by section.",
    creditCost: SALES_PAGE_CREDIT_COST,
    maxOutputTokens: SALES_PAGE_MAX_OUTPUT_TOKENS,
    buildPrompt: buildSalesPagePrompt,
  },
  landing_page: {
    assetType: "landing_page",
    label: "Landing Page",
    description: "Short registration/opt-in page copy.",
    creditCost: LANDING_PAGE_CREDIT_COST,
    maxOutputTokens: LANDING_PAGE_MAX_OUTPUT_TOKENS,
    buildPrompt: buildLandingPagePrompt,
  },
  email_sequence: {
    assetType: "email_sequence",
    label: "Email / Launch Sequence",
    description: "7-email launch sequence following the belief-shift arc.",
    creditCost: EMAIL_SEQUENCE_CREDIT_COST,
    maxOutputTokens: EMAIL_SEQUENCE_MAX_OUTPUT_TOKENS,
    buildPrompt: buildEmailSequencePrompt,
  },
  ppt_outline: {
    assetType: "ppt_outline",
    label: "Your Signature Webinar",
    description: "Your finished, presentable signature webinar deck — slide-by-slide titles + speaker notes, built from your Webinar Blueprint.",
    creditCost: PPT_OUTLINE_CREDIT_COST,
    maxOutputTokens: PPT_OUTLINE_MAX_OUTPUT_TOKENS,
    buildPrompt: buildPptOutlinePrompt,
    isOutputIncomplete: isPptOutlineIncomplete,
    continuationHint: PPT_OUTLINE_CONTINUATION_HINT,
  },
  ad_copy: {
    assetType: "ad_copy",
    label: "Ad Copy",
    description: "Facebook/Instagram ad variations + a YouTube pre-roll script.",
    creditCost: AD_COPY_CREDIT_COST,
    maxOutputTokens: AD_COPY_MAX_OUTPUT_TOKENS,
    buildPrompt: buildAdCopyPrompt,
  },
  offer_ladder: {
    assetType: "offer_ladder",
    label: "Offer Ladder",
    description: "Lead magnet → low → mid → high-ticket ascension journey.",
    creditCost: OFFER_LADDER_CREDIT_COST,
    maxOutputTokens: OFFER_LADDER_MAX_OUTPUT_TOKENS,
    buildPrompt: buildOfferLadderPrompt,
  },
  thank_you_page: {
    assetType: "thank_you_page",
    label: "Thank You Page",
    description: "Confirmation page matching your funnel type — call, checkout, tripwire, or webinar.",
    creditCost: THANK_YOU_PAGE_CREDIT_COST,
    maxOutputTokens: THANK_YOU_PAGE_MAX_OUTPUT_TOKENS,
    buildPrompt: buildThankYouPagePrompt,
  },
  challenge_outline: {
    assetType: "challenge_outline",
    label: "Challenge Outline",
    description: "Day-by-day free challenge structure — daily wins, engagement, and a pitch day.",
    creditCost: CHALLENGE_CREDIT_COST,
    maxOutputTokens: CHALLENGE_MAX_OUTPUT_TOKENS,
    buildPrompt: buildChallengeOutlinePrompt,
  },
  webinar_script: {
    assetType: "webinar_script",
    label: "Webinar Script",
    description: "The full spoken talk-track for Your Signature Webinar's slide deck — what to say on every slide.",
    creditCost: WEBINAR_SCRIPT_CREDIT_COST,
    maxOutputTokens: WEBINAR_SCRIPT_MAX_OUTPUT_TOKENS,
    buildPrompt: (project, priorGenerations, extra) => buildWebinarScriptPrompt(project, priorGenerations, extra?.sourceDeckContent),
    isOutputIncomplete: isWebinarScriptIncomplete,
    continuationHint: WEBINAR_SCRIPT_CONTINUATION_HINT,
  },
  course_outline: {
    assetType: "course_outline",
    label: "Course Outline",
    description: "Module-by-module transformational course curriculum — Basic, Intermediate, or Advanced.",
    creditCost: COURSE_OUTLINE_CREDIT_COST,
    maxOutputTokens: COURSE_OUTLINE_MAX_OUTPUT_TOKENS,
    // Adapts the generic (project, prior, extra?) shape every other generator ignores into
    // buildCourseOutlinePrompt's own cleanly-typed CourseLevel + customNaming params — see
    // BuildPromptExtra above.
    buildPrompt: (project, priorGenerations, extra) =>
      buildCourseOutlinePrompt(
        project,
        priorGenerations,
        extra?.courseLevel && isCourseLevel(extra.courseLevel) ? extra.courseLevel : undefined,
        extra?.customNaming
      ),
  },
  course_module_slides: {
    assetType: "course_module_slides",
    label: "Build Module Slides",
    description: "Turns one module of an existing Course Outline into a real, presentable slide-by-slide teaching deck.",
    creditCost: COURSE_MODULE_SLIDES_CREDIT_COST,
    maxOutputTokens: COURSE_MODULE_SLIDES_MAX_OUTPUT_TOKENS,
    // Ignores the standard priorGenerations entirely — the full course outline text (fetched
    // directly in the API route, not through the shared truncated-context helper) and which
    // module to build arrive via extra instead. See BuildPromptExtra above.
    buildPrompt: (project, _priorGenerations, extra) =>
      buildCourseModuleSlidesPrompt(project, extra?.courseOutlineFullContent ?? "", extra?.moduleIdentifier ?? ""),
    isOutputIncomplete: isCourseModuleSlidesIncomplete,
    continuationHint: COURSE_MODULE_SLIDES_CONTINUATION_HINT,
  },
  course_module_quiz: {
    assetType: "course_module_quiz",
    label: "Module Quiz",
    description: "Knowledge-check quiz for one module of an existing Course Outline — multiple choice, true/false, and short-answer, with an answer key.",
    creditCost: COURSE_MODULE_QUIZ_CREDIT_COST,
    maxOutputTokens: COURSE_MODULE_QUIZ_MAX_OUTPUT_TOKENS,
    // Same extra shape as Build Module Slides — the full course outline text and which module to
    // quiz arrive via extra rather than the standard priorGenerations. See BuildPromptExtra above.
    buildPrompt: (project, _priorGenerations, extra) =>
      buildCourseModuleQuizPrompt(project, extra?.courseOutlineFullContent ?? "", extra?.moduleIdentifier ?? ""),
  },
  course_module_workbook: {
    assetType: "course_module_workbook",
    label: "Module Workbook",
    description: "Fillable student workbook for one module of an existing Course Outline — exercises, reflection prompts, and a completion checklist.",
    creditCost: COURSE_MODULE_WORKBOOK_CREDIT_COST,
    maxOutputTokens: COURSE_MODULE_WORKBOOK_MAX_OUTPUT_TOKENS,
    // Same extra shape as its two siblings above.
    buildPrompt: (project, _priorGenerations, extra) =>
      buildCourseModuleWorkbookPrompt(project, extra?.courseOutlineFullContent ?? "", extra?.moduleIdentifier ?? ""),
  },
};

export const ASSET_TYPES = Object.keys(ASSET_GENERATORS) as GeneratorAssetType[];
