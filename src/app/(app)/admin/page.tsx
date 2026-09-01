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
import RevokeAccessButton from "./RevokeAccessButton";
import DeleteMemberButton from "./DeleteMemberButton";
import ResendCredentialsButton from "./ResendCredentialsButton";
import SetPasswordForm from "./SetPasswordForm";

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
      .select(
        "id, email, full_name, role, tier, bonus_niche_limit, credits_balance, credits_monthly_allotment, access_expires_at, stripe_subscription_id"
      )
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
      {error === "cant-revoke-self" && (
        <p className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          You can&apos;t revoke your own access — have another admin do it if you really need to.
        </p>
      )}
      {error === "cant-delete-self" && (
        <p className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          You can&apos;t delete your own account — have another admin do it if you really need to.
        </p>
      )}
      {error === "delete-failed" && (
        <p className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not delete that member — try again, or check the server logs if it keeps happening.
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
        <h2 className="font-display font-semibold">Environment check</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What this specific running deployment actually sees, right now — not what&apos;s saved
          in Vercel&apos;s settings (those can differ if a variable was added but never
          redeployed, or added to the wrong environment). Values are never shown, only whether
          each one is present and its length, enough to confirm it&apos;s really there without
          exposing it.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Saving a variable in Vercel&apos;s Settings does not, by itself, update the live app —
          it only takes effect on the next actual deployment. If this still says &quot;missing&quot;
          right after saving it, that&apos;s the reason: go to Deployments → latest → the ⋯ menu →
          Redeploy.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { label: "OPENAI_API_KEY (Read Aloud, video transcription)", value: process.env.OPENAI_API_KEY },
            { label: "ANTHROPIC_API_KEY (every generator)", value: process.env.ANTHROPIC_API_KEY },
            { label: "SUPABASE_SERVICE_ROLE_KEY", value: process.env.SUPABASE_SERVICE_ROLE_KEY },
            { label: "STRIPE_SECRET_KEY", value: process.env.STRIPE_SECRET_KEY },
            { label: "RESEND_API_KEY (member login credential emails)", value: process.env.RESEND_API_KEY },
            { label: "RESEND_FROM_EMAIL", value: process.env.RESEND_FROM_EMAIL },
          ].map(({ label, value }) => {
            const present = Boolean(value && value.trim());
            return (
              <div
                key={label}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${
                  present ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/40 bg-destructive/10"
                }`}
              >
                <span className="text-muted-foreground">{label}</span>
                <span className={present ? "text-emerald-400" : "text-destructive"}>
                  {present ? `set (${value!.trim().length} chars)` : "missing"}
                </span>
              </div>
            );
          })}
        </div>
        {/* Not a secret — shown in full, since "is it set" isn't the useful question here, "is
            it actually your real domain and not the localhost fallback" is. A missing/wrong
            value here is exactly why member-invite and Stripe checkout links can look "broken." */}
        {(() => {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
          const isLocalhost = !appUrl || appUrl.includes("localhost");
          return (
            <div
              className={`mt-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${
                isLocalhost ? "border-destructive/40 bg-destructive/10" : "border-emerald-500/30 bg-emerald-500/5"
              }`}
            >
              <span className="text-muted-foreground">
                NEXT_PUBLIC_APP_URL (member invite links, Stripe checkout redirects)
              </span>
              <span className={isLocalhost ? "text-destructive" : "text-emerald-400"}>
                {appUrl || "missing (falls back to http://localhost:3000)"}
              </span>
            </div>
          );
        })()}
        <p className="mt-2 text-xs text-muted-foreground">
          Deployed at: {process.env.VERCEL_ENV ?? "unknown"}
          {process.env.VERCEL_GIT_COMMIT_SHA ? ` · commit ${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : ""}
        </p>
      </div>

      <div className="card-elevated mb-8 rounded-2xl p-5">
        <h2 className="font-display font-semibold">Service accounts &amp; billing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every outside account Pitch Perfect AI actually depends on to run. If any of these lapse
          on payment or run out of credits, the matching feature breaks for every member — usually
          with no warning inside this app itself. Worth a monthly check.
        </p>
        <div className="mt-3 space-y-2">
          {[
            {
              name: "Vercel",
              billingUrl: "https://vercel.com/account/billing",
              dashboardUrl: "https://vercel.com/dashboard",
              breaksIfLapsed: "The whole app goes down — this is what hosts and serves it.",
            },
            {
              name: "Supabase",
              billingUrl: "https://supabase.com/dashboard/org/_/billing",
              dashboardUrl: "https://supabase.com/dashboard",
              breaksIfLapsed:
                "Database, logins, and all file storage (video uploads, ad images) — the whole app goes down without it.",
            },
            {
              name: "Anthropic (Claude)",
              billingUrl: "https://console.anthropic.com/settings/billing",
              dashboardUrl: "https://console.anthropic.com",
              breaksIfLapsed:
                "Every generator agent (webinar, VSL, sales page, PPT, emails, ad copy, offer ladder, headline lab, discovery assist, presentation analysis) stops producing anything.",
            },
            {
              name: "OpenAI",
              billingUrl: "https://platform.openai.com/settings/organization/billing",
              dashboardUrl: "https://platform.openai.com",
              breaksIfLapsed: "Read Aloud (TTS) and video transcription/analysis stop working.",
            },
            {
              name: "Stripe",
              billingUrl: "https://dashboard.stripe.com/settings/billing",
              dashboardUrl: "https://dashboard.stripe.com",
              breaksIfLapsed:
                "This is where members' own payments to you land — a lapse here means signups, renewals, and credit top-ups stop processing.",
            },
          ].map((service) => (
            <div key={service.name} className="rounded-lg border border-border bg-card/30 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{service.name}</span>
                <div className="flex gap-2 text-xs">
                  <a
                    href={service.dashboardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Dashboard
                  </a>
                  <span className="text-muted-foreground">·</span>
                  <a
                    href={service.billingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Billing
                  </a>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{service.breaksIfLapsed}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Not listed here because they&apos;re not billed accounts: your domain registrar (wherever
          perfectpitchai.app was purchased) — check that separately, it renews yearly, not monthly.
        </p>
      </div>

      <div className="card-elevated mb-8 rounded-2xl border-destructive/40 p-5">
        <h2 className="font-display font-semibold">Before video analysis or long generations work reliably</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deliberately not upgraded yet to avoid a monthly cost before launch — but this is no
          longer just about video. Do these when you&apos;re ready:
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Supabase Pro</span> ($25/mo) — Free
            tier&apos;s 1GB storage and low upload-size limit will reject most videos. Settings →
            Storage → &quot;Upload file size limit&quot; needs raising after upgrading.
          </li>
          <li>
            <span className="font-medium text-foreground">Vercel Pro</span> (~$20/mo) — Free
            (Hobby) tier caps a single generation request at 60 seconds, regardless of what the
            code requests. Video analysis needs longer than that, and so does a genuinely large
            text generation — the PPT outline&apos;s required 60-90 slides, or a 7-email sequence
            that needs to auto-continue, can both take several sequential AI calls that add up to
            more than 60 seconds. On the free tier, a generation that runs past that gets killed
            mid-request: it looks like &quot;wrote nothing&quot; or &quot;didn&apos;t save&quot;
            to the member, when what actually happened is the platform cut it off before it
            could finish and record the result.
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Shorter generators (webinar outline, sales page, landing page, ad copy) usually finish
          well under 60 seconds and are fine either way — it&apos;s specifically the PPT outline
          and video analysis that need the longer ceiling Vercel Pro allows.
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
          Creates their account directly with full access — no Stripe checkout, no invite link to
          click. They&apos;re emailed their login email and password right away and can sign in
          immediately. Useful for comping a founding member, adding a teammate, or a beta tester.
          You can still change any of this later from the table below.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          The password is always shown here too, in case the welcome email doesn&apos;t send
          (e.g. RESEND_API_KEY isn&apos;t set yet — see Environment check above) — copy it and
          send it yourself as a fallback.
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
                <th className="px-4 py-2">Actions</th>
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
                      <SetPasswordForm userId={m.id} email={m.email} />
                    </td>
                    <td className="px-4 py-3">
                      <MemberRoleForm userId={m.id} currentRole={m.role} />
                    </td>
                    <td className="px-4 py-3">
                      <MemberTierForm userId={m.id} currentTier={m.tier} currentBonusNicheLimit={m.bonus_niche_limit} />
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
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <ResendCredentialsButton userId={m.id} email={m.email} fullName={m.full_name} />
                        <RevokeAccessButton userId={m.id} isActive={isActiveMember} />
                        <DeleteMemberButton userId={m.id} email={m.email} />
                      </div>
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
