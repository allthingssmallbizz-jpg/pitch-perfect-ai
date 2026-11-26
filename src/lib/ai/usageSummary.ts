// Totals for the admin AI Spend page, from ai_usage_log rows. Pure — no database access.

import { AGENTS, type AgentAssetType } from "@/lib/agents/config";
import type { AiUsageLog } from "@/types/database";

const FEATURE_LABELS: Record<string, string> = {
  strategy_review: "Strategy Review",
  strategy_coach: "Improve My Strategy — coach chats",
  webinar_score: "Score My Webinar",
  value_basis_help: "Value Basis — “Help me explain it”",
  discovery_assist: "Discovery — AI help on answers",
  discovery_import_website: "Discovery — import from website",
  offer_builder: "Offer Builder",
  headlines: "Headline Lab",
  ihelp_builder: "iHelp Builder",
  brand_colors: "Brand Voice — surprise colors",
  ad_image: "Image Ads",
  social_compare: "Social media comparison",
  analyze: "Presentation analysis",
  video_analysis: "Video analysis",
  untagged: "Other (not labeled)",
};

const ASSET_LABELS: Record<string, string> = {
  ppt_outline: "Signature Webinar slide deck",
  webinar_script: "Webinar script",
  webinar_outline: "Webinar blueprint",
  express_deck: "Express presentation",
  express_kit: "Express Speaker Kit",
};

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function featureLabel(feature: string): string {
  if (FEATURE_LABELS[feature]) return FEATURE_LABELS[feature];
  const m = feature.match(/^(generate|edit):(.+)$/);
  if (m) {
    const agent = AGENTS[m[2] as AgentAssetType];
    const what = ASSET_LABELS[m[2]] ?? humanize(m[2]);
    const prefix = m[1] === "edit" ? "Edit — " : "";
    return `${prefix}${what}${agent ? ` (${agent.name})` : ""}`;
  }
  return humanize(feature);
}

type Row = Pick<AiUsageLog, "created_at" | "user_id" | "feature" | "status" | "cost_usd" | "output_estimated">;

export type DaySpend = { day: string; cost: number; calls: number; failedCost: number };
export type FeatureSpend = {
  feature: string;
  label: string;
  calls: number;
  cost: number;
  failedCalls: number;
  failedCost: number;
};
export type MemberSpend = { userId: string | null; calls: number; cost: number };

// "Didn't finish" = failed or stopped partway: billed for what was written, but nothing saved.
export function isUnfinished(status: string): boolean {
  return status === "error" || status === "stopped";
}

export function summarizeAiUsage(rows: Row[], days: number, now = new Date()) {
  const byDay = new Map<string, DaySpend>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { day: key, cost: 0, calls: 0, failedCost: 0 });
  }
  const byFeature = new Map<string, FeatureSpend>();
  const byMember = new Map<string, MemberSpend>();
  let total = 0;
  let failed = 0;
  let failedCalls = 0;
  let estimatedCalls = 0;

  for (const r of rows) {
    const cost = Number(r.cost_usd) || 0;
    const unfinished = isUnfinished(r.status);
    total += cost;
    if (unfinished) {
      failed += cost;
      failedCalls++;
    }
    if (r.output_estimated) estimatedCalls++;

    const day = byDay.get(r.created_at.slice(0, 10));
    if (day) {
      day.cost += cost;
      day.calls++;
      if (unfinished) day.failedCost += cost;
    }

    const f = byFeature.get(r.feature) ?? {
      feature: r.feature,
      label: featureLabel(r.feature),
      calls: 0,
      cost: 0,
      failedCalls: 0,
      failedCost: 0,
    };
    f.calls++;
    f.cost += cost;
    if (unfinished) {
      f.failedCalls++;
      f.failedCost += cost;
    }
    byFeature.set(r.feature, f);

    const memberKey = r.user_id ?? "none";
    const m = byMember.get(memberKey) ?? { userId: r.user_id, calls: 0, cost: 0 };
    m.calls++;
    m.cost += cost;
    byMember.set(memberKey, m);
  }

  return {
    total,
    calls: rows.length,
    failed,
    failedCalls,
    estimatedCalls,
    days: [...byDay.values()],
    features: [...byFeature.values()].sort((a, b) => b.cost - a.cost),
    members: [...byMember.values()].sort((a, b) => b.cost - a.cost),
  };
}

export function formatUsd(n: number): string {
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}
