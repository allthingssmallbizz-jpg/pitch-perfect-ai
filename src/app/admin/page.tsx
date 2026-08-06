import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setKillSwitch } from "@/lib/actions/admin";
import DailyCapForm from "./DailyCapForm";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viewerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (viewerProfile?.role !== "admin") redirect("/dashboard");

  const [{ data: settings }, { data: profiles }] = await Promise.all([
    supabase.from("admin_settings").select("*").eq("id", true).single(),
    supabase.from("profiles").select("id, email, credits_balance, role"),
  ]);

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { data: monthGenerations } = await supabase
    .from("generations")
    .select("user_id, cost_usd, input_tokens, output_tokens, created_at, status, asset_type")
    .gte("created_at", startOfMonth.toISOString())
    .order("created_at", { ascending: false });

  const generations = monthGenerations ?? [];
  const todaysSpend = generations
    .filter((g) => new Date(g.created_at) >= startOfDay)
    .reduce((sum, g) => sum + Number(g.cost_usd ?? 0), 0);
  const monthSpend = generations.reduce((sum, g) => sum + Number(g.cost_usd ?? 0), 0);

  const byUser = new Map<string, { generations: number; cost: number; tokens: number }>();
  for (const g of generations) {
    const entry = byUser.get(g.user_id) ?? { generations: 0, cost: 0, tokens: 0 };
    entry.generations += 1;
    entry.cost += Number(g.cost_usd ?? 0);
    entry.tokens += (g.input_tokens ?? 0) + (g.output_tokens ?? 0);
    byUser.set(g.user_id, entry);
  }

  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));
  const rows = [...byUser.entries()]
    .map(([userId, stats]) => ({ userId, email: emailById.get(userId) ?? userId, ...stats }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Admin</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-xs uppercase text-neutral-400">Spend today</div>
          <div className="text-xl font-semibold">${todaysSpend.toFixed(2)}</div>
          <div className="text-xs text-neutral-400">cap ${Number(settings?.daily_spend_cap_usd ?? 0).toFixed(2)}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-xs uppercase text-neutral-400">Spend this month</div>
          <div className="text-xl font-semibold">${monthSpend.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-xs uppercase text-neutral-400">Members</div>
          <div className="text-xl font-semibold">{profiles?.length ?? 0}</div>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold">Kill switch</h2>
        <p className="mt-1 text-sm text-neutral-600">
          {settings?.kill_switch_enabled
            ? `Generations are currently PAUSED. ${settings.kill_switch_reason ? `Reason: ${settings.kill_switch_reason}` : ""}`
            : "Generations are running normally. Use this to instantly halt all generation if you see a bug or abuse."}
        </p>
        <form action={setKillSwitch} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="hidden"
            name="enabled"
            value={settings?.kill_switch_enabled ? "false" : "true"}
          />
          {!settings?.kill_switch_enabled && (
            <input
              name="reason"
              placeholder="Reason (shown to users)"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
          )}
          <button
            type="submit"
            className={
              settings?.kill_switch_enabled
                ? "rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-500"
                : "rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500"
            }
          >
            {settings?.kill_switch_enabled ? "Resume generations" : "Pause all generations"}
          </button>
        </form>
      </div>

      <div className="mb-8 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold">Daily spend cap</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Global ceiling across all users. Once today&apos;s spend hits this, generations are blocked
          until UTC midnight.
        </p>
        <DailyCapForm currentCap={Number(settings?.daily_spend_cap_usd ?? 25)} />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Cost by member — this month
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No generations yet this month.</p>
      ) : (
        <table className="w-full overflow-hidden rounded-lg border border-neutral-200 bg-white text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Member</th>
              <th className="px-4 py-2">Generations</th>
              <th className="px-4 py-2">Tokens</th>
              <th className="px-4 py-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className="border-t border-neutral-100">
                <td className="px-4 py-2">{row.email}</td>
                <td className="px-4 py-2">{row.generations}</td>
                <td className="px-4 py-2">{row.tokens.toLocaleString()}</td>
                <td className="px-4 py-2">${row.cost.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
