import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { getPresenterBioProfiles, TIER_NICHE_LIMITS } from "@/lib/ai/presenterBio";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Self-heals a missing profiles row (see src/lib/profile.ts) before any child page renders,
  // so every page downstream can trust a straightforward `.select().eq("id", user.id).single()`
  // will find one.
  const profile = await ensureProfile(user.id, user.email ?? "");

  // Drives the pulsating "Start Here" badge on the sidebar's "My Bio" link (see StartHereBadge) —
  // stays lit until every bio on the account is actually finished, not just started. A half-done
  // bio still blocks its project's agents, so the badge keeps the pressure on rather than going
  // quiet the moment a first bio merely exists. Fetched once here rather than per-page since every
  // page under this layout shares the same sidebar.
  const bios = await getPresenterBioProfiles(supabase, user.id);
  const bioIncomplete = bios.length === 0 || bios.some((b) => b.incomplete);

  // The sidebar's project switcher (see AppSidebar's "Your projects" group) only earns its
  // place for an account that can actually hold more than one project at once — a Gold member
  // capped at 1 would just see a single-item list duplicating the "New project" link right above
  // it. Keyed off the real effective limit (tier + any admin-granted bonus), not a hardcoded
  // tier name, so a Gold account an admin bumped past 1 project gets the switcher too.
  const tier = profile?.tier ?? "Gold";
  const projectLimit = TIER_NICHE_LIMITS[tier] + (profile?.bonus_niche_limit ?? 0);
  const showProjectTabs = projectLimit > 1;
  const { data: sidebarProjects } = showProjectTabs
    ? await supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
    : { data: null };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar
          email={user.email ?? ""}
          displayName={profile?.full_name || null}
          isAdmin={profile?.role === "admin"}
          credits={profile?.credits_balance ?? null}
          bioIncomplete={bioIncomplete}
          projects={showProjectTabs ? (sidebarProjects ?? []) : null}
        />
        <SidebarInset className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border/60 bg-background/70 px-4 backdrop-blur-sm">
            <SidebarTrigger />
          </header>
          <main className="flex-1">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
