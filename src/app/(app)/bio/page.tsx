import { redirect } from "next/navigation";
import Link from "next/link";
import { UserCircle, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPresenterBioProfiles, TIER_NICHE_LIMITS } from "@/lib/ai/presenterBio";
import StartHereBadge from "@/components/StartHereBadge";
import NewNicheForm from "@/components/NewNicheForm";
import DeleteNicheButton from "@/components/DeleteNicheButton";

// The account-level list of "niches" — a member running genuinely different businesses under one
// login (a travel agent who also coaches diabetes patients, say) keeps a separate bio per niche
// instead of overwriting one shared bio every time they switch. Each project picks exactly one
// niche at creation time (see NewProjectForm.tsx); how many an account can create is capped by
// membership tier plus any admin-granted bonus (see TIER_NICHE_LIMITS, canCreateBioProfile).
export default async function PresenterBioListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, niches] = await Promise.all([
    supabase.from("profiles").select("tier, bonus_niche_limit").eq("id", user.id).single(),
    getPresenterBioProfiles(supabase, user.id),
  ]);

  const tier = profile?.tier ?? "Gold";
  const bonusNicheLimit = profile?.bonus_niche_limit ?? 0;
  const limit = TIER_NICHE_LIMITS[tier] + bonusNicheLimit;
  const atLimit = niches.length >= limit;
  const nextTier: Partial<Record<typeof tier, string>> = { Gold: "Silver", Silver: "Platinum" };
  const upgradeHint = nextTier[tier]
    ? ` Upgrade to ${nextTier[tier]} for more, or ask an admin for a bonus niche.`
    : "";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <UserCircle className="h-6 w-6 text-primary" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-3xl font-bold text-gradient-silver">My Niches</h1>
            {niches.length === 0 && <StartHereBadge />}
          </div>
          <p className="mt-1 text-muted-foreground">
            One bio per niche — a project picks exactly one when it&apos;s created, so switching
            niches never means overwriting a bio a different project still relies on.{" "}
            {Number.isFinite(limit)
              ? `${tier} members get ${limit} niche${limit === 1 ? "" : "s"}.`
              : `${tier} members get unlimited niches.`}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <NewNicheForm disabled={atLimit} limitMessage={`${tier} members get ${limit} niche${limit === 1 ? "" : "s"}.${upgradeHint}`} />
      </div>

      {niches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No niches yet — create your first one above.</p>
      ) : (
        <div className="grid gap-3">
          {niches.map((n) => (
            <div
              key={n.id}
              className="card-elevated flex items-center gap-4 rounded-xl p-5 transition-colors hover:border-primary/40"
            >
              <div className="min-w-0 flex-1">
                <Link href={`/bio/${n.id}`} className="font-display text-base font-semibold transition-colors hover:text-primary">
                  {n.label}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {n.incomplete ? "Incomplete — required fields still missing" : "Complete"}
                </p>
              </div>
              <Link
                href={`/bio/${n.id}`}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Edit <ArrowRight className="h-4 w-4" />
              </Link>
              <DeleteNicheButton profileId={n.id} label={n.label} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
