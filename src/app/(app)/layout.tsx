import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
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
  // a member logging in with zero bios yet gets an unmissable answer to "where do I start?" on
  // every single page, not just the dashboard. This is deliberately just "do you have any bio at
  // all," not "is a specific bio complete" — that stricter, per-project completeness check now
  // lives at the project level (each project has its own bio, auto-created when it's created; see
  // isPresenterBioIncomplete usage in generate/[assetType]/page.tsx etc.), since there's no single
  // project context to check from the sidebar. Fetched once here rather than per-page since every
  // page under this layout shares the same sidebar.
  const { count: nicheCount } = await supabase
    .from("presenter_bio_profiles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const bioIncomplete = (nicheCount ?? 0) === 0;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar
          email={user.email ?? ""}
          displayName={profile?.full_name || null}
          isAdmin={profile?.role === "admin"}
          credits={profile?.credits_balance ?? null}
          bioIncomplete={bioIncomplete}
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
