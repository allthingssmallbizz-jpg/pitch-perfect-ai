import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface PageStats {
  views: number;
  leads: number;
  // null (not 0) when there have been no views yet — "no data" and "0% conversion" mean
  // different things, and showing "0%" before a page has any traffic is misleading.
  conversionPct: number | null;
}

const EMPTY_STATS: PageStats = { views: 0, leads: 0, conversionPct: null };

// Views come from page_views (one row per /site/[slug] load); leads come from the form_leads
// table forms/submit already writes to. Both are keyed by generation_id, so a Thank You Page
// naturally shows only its own views (visitors land there, they don't submit its form) while a
// Landing Page shows both — no separate "which asset type" branching needed.
export async function getPageStatsForGenerations(
  supabase: SupabaseClient<Database>,
  generationIds: string[]
): Promise<Map<string, PageStats>> {
  const stats = new Map<string, PageStats>();
  if (generationIds.length === 0) return stats;

  const [{ data: views }, { data: leads }] = await Promise.all([
    supabase.from("page_views").select("generation_id").in("generation_id", generationIds),
    supabase.from("form_leads").select("generation_id").in("generation_id", generationIds),
  ]);

  const viewCounts = new Map<string, number>();
  for (const row of views ?? []) {
    viewCounts.set(row.generation_id, (viewCounts.get(row.generation_id) ?? 0) + 1);
  }
  const leadCounts = new Map<string, number>();
  for (const row of leads ?? []) {
    if (!row.generation_id) continue;
    leadCounts.set(row.generation_id, (leadCounts.get(row.generation_id) ?? 0) + 1);
  }

  for (const id of generationIds) {
    const viewCount = viewCounts.get(id) ?? 0;
    const leadCount = leadCounts.get(id) ?? 0;
    stats.set(id, {
      views: viewCount,
      leads: leadCount,
      conversionPct: viewCount > 0 ? Math.round((leadCount / viewCount) * 1000) / 10 : null,
    });
  }
  return stats;
}

export async function getPageStats(supabase: SupabaseClient<Database>, generationId: string): Promise<PageStats> {
  const map = await getPageStatsForGenerations(supabase, [generationId]);
  return map.get(generationId) ?? EMPTY_STATS;
}
