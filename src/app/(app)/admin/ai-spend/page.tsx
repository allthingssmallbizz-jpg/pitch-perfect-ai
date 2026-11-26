import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProfile } from "@/lib/profile";
import { summarizeAiUsage } from "@/lib/ai/usageSummary";
import type { AiUsageLog } from "@/types/database";
import AiSpendView, { AI_SPEND_RANGES } from "./AiSpendView";

const PAGE = 1000;
const MAX_ROWS = 50_000;

// Every call to the Anthropic API, from the ai_usage_log table — so this page matches the
// Anthropic bill. Days are UTC, the same days the Anthropic console uses.
export default async function AiSpendPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: daysParam } = await searchParams;
  const days = AI_SPEND_RANGES.includes(Number(daysParam) as (typeof AI_SPEND_RANGES)[number]) ? Number(daysParam) : 14;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const viewer = await ensureProfile(user.id, user.email ?? "");
  if (viewer?.role !== "admin") redirect("/admin");

  const admin = createAdminClient();
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - (days - 1)));
  const rows: AiUsageLog[] = [];
  let loadError: string | null = null;
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await admin
      .from("ai_usage_log")
      .select("*")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      loadError = error.message;
      break;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const summary = summarizeAiUsage(rows, days);
  const memberIds = summary.members.map((m) => m.userId).filter((id): id is string => Boolean(id)).slice(0, 10);
  const { data: memberProfiles } = memberIds.length
    ? await admin.from("profiles").select("id, email, full_name").in("id", memberIds)
    : { data: [] as { id: string; email: string | null; full_name: string | null }[] };
  const memberNames: Record<string, string> = {};
  for (const p of memberProfiles ?? []) memberNames[p.id] = p.full_name || p.email || p.id.slice(0, 8);
  return <AiSpendView days={days} rows={rows} summary={summary} memberNames={memberNames} loadError={loadError} />;
}
