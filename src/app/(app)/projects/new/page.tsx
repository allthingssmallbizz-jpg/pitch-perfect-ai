import { redirect } from "next/navigation";
import NewProjectForm from "./NewProjectForm";
import { AGENTS, type AgentAssetType } from "@/lib/agents/config";
import { TIER_NICHE_LIMITS } from "@/lib/ai/presenterBio";
import { createClient } from "@/lib/supabase/server";
import AgentBadge from "@/components/AgentBadge";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const agent = type && type in AGENTS ? AGENTS[type as AgentAssetType] : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { count: activeProjectCount }] = await Promise.all([
    supabase.from("profiles").select("tier, bonus_niche_limit").eq("id", user.id).single(),
    // Same count canCreateBioProfile uses — active projects with a linked niche bio, so this
    // page's own "you're at your limit" message never drifts out of sync with the actual gate.
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .not("presenter_bio_profile_id", "is", null),
  ]);

  const tier = profile?.tier ?? "Gold";
  const limit = TIER_NICHE_LIMITS[tier] + (profile?.bonus_niche_limit ?? 0);
  const atNicheLimit = (activeProjectCount ?? 0) >= limit;
  const nextTier: Partial<Record<typeof tier, string>> = { Gold: "Silver", Silver: "Platinum" };
  const nicheLimitMessage = `${tier} members get ${Number.isFinite(limit) ? limit : "unlimited"} project${limit === 1 ? "" : "s"}.${
    nextTier[tier] ? ` Upgrade to ${nextTier[tier]} for more, or ask an admin for a bonus project.` : ""
  }`;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      {agent ? (
        <div className="mb-6">
          <AgentBadge agent={agent} size="lg" showTagline />
          <p className="mt-3 text-sm text-muted-foreground">
            Name a project to get started — you&apos;ll fill in the discovery brief next.
          </p>
        </div>
      ) : (
        <h1 className="mb-6 font-display text-2xl font-semibold text-gradient-silver">Name your project</h1>
      )}
      <NewProjectForm type={type ?? null} atNicheLimit={atNicheLimit} nicheLimitMessage={nicheLimitMessage} />
    </div>
  );
}
