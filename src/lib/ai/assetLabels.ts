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
  if (assetType === "tts_narration") {
    // No dedicated page — it's a narration of already-generated content, not a browsable asset.
    return `/projects/${projectId}`;
  }
  return `/projects/${projectId}/generate/${assetType}${suffix}`;
}
