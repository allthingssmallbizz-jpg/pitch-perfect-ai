import type { AssetType, Project } from "@/types/database";
import { buildWebinarOutlinePrompt, WEBINAR_CREDIT_COST, WEBINAR_MAX_OUTPUT_TOKENS } from "./webinarOutline";
import { buildVslScriptPrompt, VSL_CREDIT_COST, VSL_MAX_OUTPUT_TOKENS } from "./vslScript";
import { buildSalesPagePrompt, SALES_PAGE_CREDIT_COST, SALES_PAGE_MAX_OUTPUT_TOKENS } from "./salesPage";
import { buildLandingPagePrompt, LANDING_PAGE_CREDIT_COST, LANDING_PAGE_MAX_OUTPUT_TOKENS } from "./landingPage";
import { buildEmailSequencePrompt, EMAIL_SEQUENCE_CREDIT_COST, EMAIL_SEQUENCE_MAX_OUTPUT_TOKENS } from "./emailSequence";
import { buildPptOutlinePrompt, PPT_OUTLINE_CREDIT_COST, PPT_OUTLINE_MAX_OUTPUT_TOKENS } from "./pptOutline";

export interface AssetGenerator {
  assetType: AssetType;
  label: string;
  description: string;
  creditCost: number;
  maxOutputTokens: number;
  buildPrompt: (project: Project) => string;
}

export const ASSET_GENERATORS: Record<AssetType, AssetGenerator> = {
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
};

export const ASSET_TYPES = Object.keys(ASSET_GENERATORS) as AssetType[];
