import type { AssetType, Project } from "@/types/database";
import { buildWebinarOutlinePrompt, WEBINAR_CREDIT_COST, WEBINAR_MAX_OUTPUT_TOKENS } from "./webinarOutline";
import { buildVslScriptPrompt, VSL_CREDIT_COST, VSL_MAX_OUTPUT_TOKENS } from "./vslScript";
import { buildSalesPagePrompt, SALES_PAGE_CREDIT_COST, SALES_PAGE_MAX_OUTPUT_TOKENS } from "./salesPage";
import { buildLandingPagePrompt, LANDING_PAGE_CREDIT_COST, LANDING_PAGE_MAX_OUTPUT_TOKENS } from "./landingPage";
import { buildEmailSequencePrompt, EMAIL_SEQUENCE_CREDIT_COST, EMAIL_SEQUENCE_MAX_OUTPUT_TOKENS } from "./emailSequence";
import { buildPptOutlinePrompt, PPT_OUTLINE_CREDIT_COST, PPT_OUTLINE_MAX_OUTPUT_TOKENS } from "./pptOutline";
import { buildAdCopyPrompt, AD_COPY_CREDIT_COST, AD_COPY_MAX_OUTPUT_TOKENS } from "./adCopy";
import { buildOfferLadderPrompt, OFFER_LADDER_CREDIT_COST, OFFER_LADDER_MAX_OUTPUT_TOKENS } from "./offerLadder";

// Excludes "presentation_analysis" and "headline_lab" — neither is driven by a project's
// discovery fields (their input is pasted content / a topic brief), so they aren't part
// of this registry. See src/lib/ai/analyzer.ts, src/lib/ai/headlineLab.ts, and
// src/lib/ai/assetLabels.ts.
export type GeneratorAssetType = Exclude<
  AssetType,
  "presentation_analysis" | "headline_lab" | "tts_narration" | "discovery_assist"
>;

export interface AssetGenerator {
  assetType: GeneratorAssetType;
  label: string;
  description: string;
  creditCost: number;
  maxOutputTokens: number;
  buildPrompt: (project: Project) => string;
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
};

export const ASSET_TYPES = Object.keys(ASSET_GENERATORS) as GeneratorAssetType[];
