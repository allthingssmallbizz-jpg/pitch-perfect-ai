import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { formatCreditsLabel } from "@/lib/credits";
import BillingActions from "./BillingActions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ensureProfile (not a raw select + redirect("/login")) — a missing profiles row is a data
  // problem, not a "you're not logged in" problem. Redirecting to /login while authenticated
  // used to bounce straight back to /dashboard via the auth middleware's already-logged-in
  // redirect, which looked like "Billing just takes me back to the dashboard."
  const profile = await ensureProfile(user.id, user.email ?? "");
  const { data: topups } = await supabase
    .from("credit_topups")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-4 font-display text-2xl font-semibold text-gradient-silver">Billing</h1>
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Couldn&apos;t load your account. Try refreshing — if this keeps happening, let support know.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 font-display text-2xl font-semibold text-gradient-silver">Billing</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card-elevated rounded-xl p-4">
          <div className="text-xs uppercase text-muted-foreground">Credits</div>
          <div className="text-xl font-semibold">{formatCreditsLabel(profile)}</div>
        </div>
        <div className="card-elevated rounded-xl p-4">
          <div className="text-xs uppercase text-muted-foreground">Resets</div>
          <div className="text-xl font-semibold">{formatDate(profile.credits_reset_at)}</div>
        </div>
        <div className="card-elevated rounded-xl p-4">
          <div className="text-xs uppercase text-muted-foreground">Access until</div>
          <div className="text-xl font-semibold">{formatDate(profile.access_expires_at)}</div>
        </div>
      </div>

      <BillingActions hasMembership={Boolean(profile.stripe_subscription_id)} />

      {topups && topups.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Top-up history
          </h2>
          <ul className="space-y-2 text-sm">
            {topups.map((t) => (
              <li key={t.id} className="flex justify-between rounded-lg border border-border bg-card/40 px-4 py-2">
                <span>{t.credits} credits</span>
                <span className="text-muted-foreground">
                  ${t.amount_usd} · {formatDate(t.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
