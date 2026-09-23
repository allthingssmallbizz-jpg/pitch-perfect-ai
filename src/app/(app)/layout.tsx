import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { UserCog } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { getPresenterBioProfiles, TIER_NICHE_LIMITS } from "@/lib/ai/presenterBio";
import { IMPERSONATOR_COOKIE, type ImpersonatorSession } from "@/lib/impersonation";
import { returnToAdmin } from "@/lib/actions/admin";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
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

  // Set only while an admin is "logged in as" this account (see adminImpersonateMember /
  // returnToAdmin in src/lib/actions/admin.ts) — httpOnly, so this is the only place that can
  // ever see it; a member's own session never has it. Shown as a banner that can't be missed
  // (unlike a sidebar link, which scrolls out of view) since accidentally leaving it open means
  // continuing to act as this member without realizing it.
  const cookieStore = await cookies();
  const impersonatorRaw = cookieStore.get(IMPERSONATOR_COOKIE)?.value;
  let impersonator: ImpersonatorSession | null = null;
  if (impersonatorRaw) {
    try {
      impersonator = JSON.parse(impersonatorRaw) as ImpersonatorSession;
    } catch {
      impersonator = null;
    }
  }

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
          <div className="sticky top-0 z-50">
            {impersonator && (
              <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-1.5 text-sm font-medium text-amber-950">
                <span className="flex items-center gap-1.5">
                  <UserCog className="h-4 w-4" />
                  Viewing as {user.email} — nothing here notifies them.
                </span>
                <form action={returnToAdmin}>
                  <Button type="submit" size="sm" variant="secondary" className="h-6 px-2 text-xs">
                    Return to admin ({impersonator.adminEmail})
                  </Button>
                </form>
              </div>
            )}
            <header className="flex h-14 items-center gap-2 border-b border-border/60 bg-background/70 px-4 backdrop-blur-sm">
              <SidebarTrigger />
            </header>
          </div>
          <main className="flex-1">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
