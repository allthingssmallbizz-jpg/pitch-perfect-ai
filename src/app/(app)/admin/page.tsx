import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { setKillSwitch } from "@/lib/actions/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DailyCapForm from "./DailyCapForm";
import DiscoveryVideoForm from "./DiscoveryVideoForm";
import MemberCreditsForm from "./MemberCreditsForm";
import MemberRoleForm from "./MemberRoleForm";
import MemberTierForm from "./MemberTierForm";
import MemberInviteForm from "./MemberInviteForm";

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

  // ensureProfile, not a raw select — same reasoning as billing/page.tsx: a missing profiles
  // row shouldn't silently read as "not an admin." If the row genuinely says non-admin, show
  // that plainly instead of a silent bounce to /dashboard with no explanation.
  const viewerProfile = await ensureProfile(user.id, user.email ?? "");
  if (viewerProfile?.role !== "admin") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-4 font-display text-2xl font-semibold text-gradient-silver">Admin</h1>
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Your account ({user.email}) doesn&apos;t have admin access. If you expect it to, an
          existing admin needs to grant it from this same page, or run this once in the Supabase
          SQL editor:
          <br />
          <code className="mt-2 block rounded bg-black/30 px-2 py-1 text-xs">
            update public.profiles set role = &apos;admin&apos; where email = &apos;{user.email}&apos;;
          </code>
        </p>
      </div>
    );
  }

  const [{ data: settings }, { data: profiles }, { data: payments }] = await Promise.all([
    supabase.from("admin_settings").select("*").eq("id", true).single(),
    supabase
      .from("profiles")
      .select("id, email, full_name, role, tier, credits_balance, credits_monthly_allotment, access_expires_at, stripe_subscription_id")
      .order("email"),
    supabase
      .from("payments")
      .select("user_id, type, amount_usd, credits, created_at")
      .order("created_at", { ascending: false }),
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

  type PaymentEntry = { type: string; amount_usd: number; credits: number | null; created_at: string };
  const paymentsByUser = new Map<string, PaymentEntry[]>();
  for (const p of payments ?? []) {
    const entry = paymentsByUser.get(p.user_id) ?? [];
    entry.push(p);
    paymentsByUser.set(p.user_id, entry);
  }

  const allMembers = profiles ?? [];
  const query = (q ?? "").trim().toLowerCase();
  const members = query
    ? allMembers.filter(
        (p) => p.email.toLowerCase().includes(query) || (p.full_name ?? "").toLowerCase().includes(query)
      )
    : allMembers;

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

      <div className="card-elevated mb-8 rounded-2xl border-primary/30 p-5">
        <h2 className="font-display font-semibold">Before video analysis works in production</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deliberately not upgraded yet to avoid a monthly cost before launch — do these when
          you&apos;re ready to turn video analysis on for real:
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Supabase Pro</span> ($25/mo) — Free
            tier&apos;s 1GB storage and low upload-size limit will reject most videos. Settings →
            Storage → &quot;Upload file size limit&quot; needs raising after upgrading.
          </li>
          <li>
            <span className="font-medium text-foreground">Vercel Pro</span> (~$20/mo) — Free
            tier caps function execution at 60s; analyzing a full video takes longer than that.
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Nothing else in the app needs either of these — every generator, the discovery form,
          billing, and text-based analysis all work fine on free tiers.
        </p>
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

      <div className="card-elevated mb-8 rounded-2xl p-5">
        <h2 className="font-display font-semibold">Discovery walkthrough video</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a YouTube or Vimeo link and it&apos;ll show at the top of every project&apos;s
          Discovery form — most members are 45+ and have never filled out a marketing discovery
          brief before, so a short video from you on why each section matters goes further than
          more on-page text. Leave it blank to hide the section entirely.
        </p>
        <DiscoveryVideoForm currentUrl={settings?.discovery_video_url ?? null} />
      </div>

      <div className="card-elevated mb-8 rounded-2xl border-primary/30 p-5">
        <h2 className="font-display font-semibold">Roadmap: full training library</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The single walkthrough video above is the lightweight first pass on member onboarding.
          Down the line, worth building a proper &quot;classroom&quot; section — a library of multiple
          short videos organized by topic (Discovery, each generator, reading your results),
          reachable from the sidebar so members can revisit it any time, not just once on the
          Discovery form.
        </p>
      </div>

      <div className="card-elevated mb-8 rounded-2xl p-5">
        <h2 className="font-display font-semibold">Invite a member</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates their account directly (no Stripe checkout) and emails them a link to set a
          password — useful for comping a founding member, adding a teammate, or a beta tester.
          You can still change any of this later from the table below.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Supabase&apos;s free tier rate-limits how many auth emails it can send per hour — if
          an invite doesn&apos;t arrive, that&apos;s the likely cause.
        </p>
        <div className="mt-3">
          <MemberInviteForm />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Members</h2>
        <form method="GET" className="flex items-center gap-2">
          <Input name="q" defaultValue={q ?? ""} placeholder="Search by name or email..." className="h-8 w-56 text-sm" />
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
                <th className="px-4 py-2">Tier</th>
                <th className="px-4 py-2">Membership</th>
                <th className="px-4 py-2">Credits</th>
                <th className="px-4 py-2">Revenue</th>
                <th className="px-4 py-2">This month</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const usage = usageByUser.get(m.id);
                const memberPayments = paymentsByUser.get(m.id) ?? [];
                const totalRevenue = memberPayments.reduce((sum, p) => sum + Number(p.amount_usd ?? 0), 0);
                const topups = memberPayments.filter((p) => p.type === "topup");
                const isActiveMember = new Date(m.access_expires_at) > new Date();
                return (
                  <tr key={m.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <div className="max-w-[220px] truncate font-medium">{m.full_name || "—"}</div>
                      <div className="max-w-[220px] truncate text-xs text-muted-foreground">{m.email}</div>
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
                      <MemberTierForm userId={m.id} currentTier={m.tier} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <Badge variant={isActiveMember ? "default" : "secondary"}>
                        {isActiveMember ? "Active" : m.stripe_subscription_id ? "Expired" : "No membership"}
                      </Badge>
                      {m.stripe_subscription_id && (
                        <div className="mt-1 text-muted-foreground">
                          {isActiveMember ? "renews" : "expired"}{" "}
                          {new Date(m.access_expires_at).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="mb-1.5 text-xs text-muted-foreground">
                        {m.credits_balance} / {m.credits_monthly_allotment} bal.
                        {m.role === "admin" && " (not enforced)"}
                      </div>
                      <MemberCreditsForm userId={m.id} currentBalance={m.credits_balance} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">${totalRevenue.toFixed(2)}</div>
                      {topups.length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer select-none">
                            {topups.length} top-up{topups.length === 1 ? "" : "s"}
                          </summary>
                          <ul className="mt-1 space-y-0.5">
                            {topups.map((t, i) => (
                              <li key={i}>
                                {new Date(t.created_at).toLocaleDateString()} · ${Number(t.amount_usd).toFixed(2)}
                                {t.credits ? ` (${t.credits} cr)` : ""}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
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
