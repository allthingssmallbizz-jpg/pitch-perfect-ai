import { redirect } from "next/navigation";
import Link from "next/link";
import { UserCircle, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPresenterBioProfiles, TIER_NICHE_LIMITS } from "@/lib/ai/presenterBio";
import StartHereBadge from "@/components/StartHereBadge";

// One bio per project, auto-created and named after the project itself the moment it's created
// (see createProject in src/lib/actions/projects.ts) — there's no separate "create a bio" step
// here, this page is purely a list of the ones that already exist, so it's always in sync with
// the actual project list. How many an account can have is capped by membership tier plus any
// admin-granted bonus (see TIER_NICHE_LIMITS, canCreateBioProfile) — that limit is really "how
// many projects can this account have," enforced when a new project is created.
export default async function PresenterBioListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, bios, { data: linkedProjects }] = await Promise.all([
    supabase.from("profiles").select("tier, bonus_niche_limit").eq("id", user.id).single(),
    getPresenterBioProfiles(supabase, user.id),
    // Which project each bio belongs to, for the "View project" link below — the relationship is
    // stored on projects.presenter_bio_profile_id, not on the bio row itself.
    supabase
      .from("projects")
      .select("id, presenter_bio_profile_id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .not("presenter_bio_profile_id", "is", null),
  ]);

  const projectIdByProfileId = new Map((linkedProjects ?? []).map((p) => [p.presenter_bio_profile_id as string, p.id]));

  const tier = profile?.tier ?? "Gold";
  const bonusNicheLimit = profile?.bonus_niche_limit ?? 0;
  const limit = TIER_NICHE_LIMITS[tier] + bonusNicheLimit;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <UserCircle className="h-6 w-6 text-primary" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-3xl font-bold text-gradient-silver">My Bio</h1>
            {bios.length === 0 && <StartHereBadge />}
          </div>
          <p className="mt-1 text-muted-foreground">
            Every project gets its own bio, named after the project — filling one in makes every
            agent working on that project write from your real story instead of something generic.{" "}
            {Number.isFinite(limit)
              ? `${tier} members can have ${limit} project${limit === 1 ? "" : "s"}.`
              : `${tier} members can have unlimited projects.`}
          </p>
        </div>
      </div>

      {bios.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing yet —{" "}
          <Link href="/projects/new" className="text-primary hover:underline">
            start a new project
          </Link>{" "}
          and its bio is created for you automatically.
        </p>
      ) : (
        <div className="grid gap-3">
          {bios.map((b) => {
            const projectId = projectIdByProfileId.get(b.id);
            return (
              <div
                key={b.id}
                className="card-elevated flex items-center gap-4 rounded-xl p-5 transition-colors hover:border-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <Link href={`/bio/${b.id}`} className="font-display text-base font-semibold transition-colors hover:text-primary">
                    {b.label}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {b.incomplete ? "Incomplete — required fields still missing" : "Complete"}
                  </p>
                </div>
                {projectId && (
                  <Link href={`/projects/${projectId}`} className="text-sm text-muted-foreground hover:text-primary hover:underline">
                    View project
                  </Link>
                )}
                <Link href={`/bio/${b.id}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
                  Edit bio <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
