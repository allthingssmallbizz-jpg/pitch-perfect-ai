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
    return `/projects/${projectId}/social-compare${suffix}`;
  }
  if (assetType === "tts_narration" || assetType === "discovery_assist" || assetType === "website_import") {
    // No dedicated page — not a browsable asset (audio / a single field draft / fields already
    // inserted straight into the discovery form).
    return `/projects/${projectId}`;
  }
  return `/projects/${projectId}/generate/${assetType}${suffix}`;
}
