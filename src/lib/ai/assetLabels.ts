import { ASSET_GENERATORS } from "./generators";
import type { AssetType } from "@/types/database";

// Unified label/link lookup across the six discovery-driven generators (ASSET_GENERATORS)
// and the Presentation Analyzer, which isn't part of that registry (its input is pasted
// content, not project discovery fields) but still lives in the same `generations` table
// and needs to render in the same history list, admin telemetry, and export routes.

export function getAssetLabel(assetType: AssetType): string {
  if (assetType === "presentation_analysis") return "Presentation Analysis";
  return ASSET_GENERATORS[assetType].label;
}

export function getAssetHref(projectId: string, assetType: AssetType, generationId?: string): string {
  const suffix = generationId ? `?generationId=${generationId}` : "";
  if (assetType === "presentation_analysis") {
    return `/projects/${projectId}/analyze${suffix}`;
  }
  return `/projects/${projectId}/generate/${assetType}${suffix}`;
}
