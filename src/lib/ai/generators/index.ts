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
export { WEB_PAGE_ASSET_TYPES } from "./htmlPage";

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

export interface AssetGenerator {
  assetType: GeneratorAssetType;
  label: string;
  description: string;
  creditCost: number;
  maxOutputTokens: number;
  buildPrompt: (project: Project, priorGenerations: PriorGeneration[]) => string;
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
    label: "Webinar Outline",
    description: "Full PPWOS™ 7-phase webinar structure, ready to build slides from.",
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
    label: "PowerPoint Outline",
    description: "Slide-by-slide titles + speaker notes.",
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
};

export const ASSET_TYPES = Object.keys(ASSET_GENERATORS) as GeneratorAssetType[];
