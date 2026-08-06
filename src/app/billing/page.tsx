import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const { data: topups } = await supabase
    .from("credit_topups")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Billing</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-xs uppercase text-neutral-400">Credits</div>
          <div className="text-xl font-semibold">
            {profile.credits_balance} / {profile.credits_monthly_allotment}
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-xs uppercase text-neutral-400">Resets</div>
          <div className="text-xl font-semibold">{formatDate(profile.credits_reset_at)}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-xs uppercase text-neutral-400">Access until</div>
          <div className="text-xl font-semibold">{formatDate(profile.access_expires_at)}</div>
        </div>
      </div>

      <BillingActions hasMembership={Boolean(profile.stripe_subscription_id)} />

      {topups && topups.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Top-up history
          </h2>
          <ul className="space-y-2 text-sm">
            {topups.map((t) => (
              <li key={t.id} className="flex justify-between rounded-md border border-neutral-200 bg-white px-4 py-2">
                <span>{t.credits} credits</span>
                <span className="text-neutral-500">
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
