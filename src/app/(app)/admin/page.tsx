import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setKillSwitch } from "@/lib/actions/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DailyCapForm from "./DailyCapForm";
import MemberCreditsForm from "./MemberCreditsForm";
import MemberRoleForm from "./MemberRoleForm";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const { q, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viewerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (viewerProfile?.role !== "admin") redirect("/dashboard");

  const [{ data: settings }, { data: profiles }] = await Promise.all([
    supabase.from("admin_settings").select("*").eq("id", true).single(),
    supabase
      .from("profiles")
      .select("id, email, role, credits_balance, credits_monthly_allotment")
      .order("email"),
  ]);

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { data: monthGenerations } = await supabase
    .from("generations")
    .select("user_id, cost_usd, input_tokens, output_tokens, created_at")
    .gte("created_at", startOfMonth.toISOString());

  const generations = monthGenerations ?? [];
  const todaysSpend = generations
    .filter((g) => new Date(g.created_at) >= startOfDay)
    .reduce((sum, g) => sum + Number(g.cost_usd ?? 0), 0);
  const monthSpend = generations.reduce((sum, g) => sum + Number(g.cost_usd ?? 0), 0);

  const usageByUser = new Map<string, { generations: number; cost: number; tokens: number }>();
  for (const g of generations) {
    const entry = usageByUser.get(g.user_id) ?? { generations: 0, cost: 0, tokens: 0 };
    entry.generations += 1;
    entry.cost += Number(g.cost_usd ?? 0);
    entry.tokens += (g.input_tokens ?? 0) + (g.output_tokens ?? 0);
    usageByUser.set(g.user_id, entry);
  }

  const allMembers = profiles ?? [];
  const query = (q ?? "").trim().toLowerCase();
  const members = query ? allMembers.filter((p) => p.email.toLowerCase().includes(query)) : allMembers;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-6 font-display text-2xl font-semibold text-gradient-silver">Admin</h1>

      {error === "cant-demote-self" && (
        <p className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          You can&apos;t remove your own admin role — have another admin do it if you really need to.
        </p>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card-elevated rounded-xl p-4">
          <div className="text-xs uppercase text-muted-foreground">Spend today</div>
          <div className="text-xl font-semibold">${todaysSpend.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">cap ${Number(settings?.daily_spend_cap_usd ?? 0).toFixed(2)}</div>
        </div>
        <div className="card-elevated rounded-xl p-4">
          <div className="text-xs uppercase text-muted-foreground">Spend this month</div>
          <div className="text-xl font-semibold">${monthSpend.toFixed(2)}</div>
        </div>
        <div className="card-elevated rounded-xl p-4">
          <div className="text-xs uppercase text-muted-foreground">Members</div>
          <div className="text-xl font-semibold">{allMembers.length}</div>
        </div>
      </div>

      <div className="card-elevated mb-8 rounded-2xl p-5">
        <h2 className="font-display font-semibold">Kill switch</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {settings?.kill_switch_enabled
            ? `Generations are currently PAUSED. ${settings.kill_switch_reason ? `Reason: ${settings.kill_switch_reason}` : ""}`
            : "Generations are running normally. Use this to instantly halt all generation if you see a bug or abuse."}
        </p>
        <form action={setKillSwitch} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="enabled" value={settings?.kill_switch_enabled ? "false" : "true"} />
          {!settings?.kill_switch_enabled && (
            <Input name="reason" placeholder="Reason (shown to users)" className="max-w-xs" />
          )}
          <Button type="submit" variant={settings?.kill_switch_enabled ? "default" : "destructive"}>
            {settings?.kill_switch_enabled ? "Resume generations" : "Pause all generations"}
          </Button>
        </form>
      </div>

      <div className="card-elevated mb-8 rounded-2xl p-5">
        <h2 className="font-display font-semibold">Daily spend cap</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Global ceiling across all users. Once today&apos;s spend hits this, generations are blocked
          until UTC midnight.
        </p>
        <DailyCapForm currentCap={Number(settings?.daily_spend_cap_usd ?? 25)} />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Members</h2>
        <form method="GET" className="flex items-center gap-2">
          <Input name="q" defaultValue={q ?? ""} placeholder="Search by email..." className="h-8 w-56 text-sm" />
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Admin accounts skip the credit balance check entirely — an unlimited internal test
        account. Give yours the <code>admin</code> role below; the kill switch and daily spend
        cap still apply to everyone, admins included.
      </p>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No members match &quot;{q}&quot;.</p>
      ) : (
        <div className="card-elevated overflow-x-auto rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Member</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Credits</th>
                <th className="px-4 py-2">This month</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const usage = usageByUser.get(m.id);
                return (
                  <tr key={m.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <div className="max-w-[220px] truncate font-medium">{m.email}</div>
                      {m.role === "admin" && (
                        <Badge variant="secondary" className="mt-1">
                          Unlimited
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <MemberRoleForm userId={m.id} currentRole={m.role} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="mb-1.5 text-xs text-muted-foreground">
                        {m.credits_balance} / {m.credits_monthly_allotment} bal.
                      </div>
                      <MemberCreditsForm userId={m.id} currentBalance={m.credits_balance} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {usage ? (
                        <>
                          {usage.generations} gen{usage.generations === 1 ? "" : "s"} ·{" "}
                          {usage.tokens.toLocaleString()} tok
                          <br />${usage.cost.toFixed(3)}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
