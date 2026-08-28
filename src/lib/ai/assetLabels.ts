import { ASSET_GENERATORS, type GeneratorAssetType } from "./generators";
import type { AssetType } from "@/types/database";

// Unified label/link lookup across the discovery-driven generators (ASSET_GENERATORS) and
// the two tools that aren't part of that registry — the Presentation Analyzer (input is
// pasted content, not project discovery fields) and Headline Lab (not project-scoped at
// all) — which still live in the same `generations` table and need to render in the same
// history list, admin telemetry, and export routes.

export function getAssetLabel(assetType: AssetType): string {
  if (assetType === "presentation_analysis") return "Presentation Analysis";
  if (assetType === "headline_lab") return "Headline Lab";
  if (assetType === "tts_narration") return "Read Aloud (TTS)";
  if (assetType === "discovery_assist") return "AI Assist (discovery field)";
  if (assetType === "ad_image") return "Image Ad";
  if (assetType === "website_import") return "Import from website";
  if (assetType === "social_compare") return "Social Media Comparison";
  if (assetType === "offer_builder") return "Offer Builder";
  if (assetType === "brand_color_surprise") return "Surprise Me (brand colors)";
  if (assetType === "ihelp_builder") return "I Help Statement Builder";
  return ASSET_GENERATORS[assetType as GeneratorAssetType].label;
}

export function getAssetHref(projectId: string, assetType: AssetType, generationId?: string): string {
  const suffix = generationId ? `?generationId=${generationId}` : "";
  if (assetType === "presentation_analysis") {
    return `/projects/${projectId}/analyze${suffix}`;
  }
  if (assetType === "headline_lab") {
    return `/headline-lab${suffix}`;
  }
  if (assetType === "ad_image") {
    return `/projects/${projectId}/ad-image${suffix}`;
  }
  if (assetType === "social_compare") {
    // Not project-scoped (see the comment on its API route) — same as headline_lab, projectId
    // is ignored here.
    return `/social-compare${suffix}`;
  }
  if (assetType === "brand_color_surprise") {
    // Account-level, not project-scoped — same as headline_lab/social_compare.
    return `/brand-voice${suffix}`;
  }
  if (assetType === "ihelp_builder") {
    // Account-level, not project-scoped — same as brand_color_surprise, but lands on /bio
    // (where the I Help Statement fields live) instead of /brand-voice.
    return `/bio${suffix}`;
  }
  if (
    assetType === "tts_narration" ||
    assetType === "discovery_assist" ||
    assetType === "website_import" ||
    assetType === "offer_builder"
  ) {
    // No dedicated page — not a browsable asset (audio / a single field draft / fields already
    // inserted straight into the discovery form).
    return `/projects/${projectId}`;
  }
  return `/projects/${projectId}/generate/${assetType}${suffix}`;
}
