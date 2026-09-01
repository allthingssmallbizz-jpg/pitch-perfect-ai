import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { isPresenterBioIncomplete } from "@/lib/ai/presenterBio";
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

  // Drives the pulsating "Start Here" badge on the sidebar's Bio link (see StartHereBadge) — a
  // member logging in with nothing filled in yet gets an unmissable answer to "where do I start?"
  // on every single page, not just the dashboard. Stays lit until every field marked required on
  // the bio form (see REQUIRED_BIO_FIELDS) is actually filled in, not just "started" — a half-done
  // bio still blocks every agent, so the badge keeping the pressure on matches that. Fetched once
  // here rather than per-page since every page under this layout shares the same sidebar.
  const { data: bio } = await supabase.from("presenter_bios").select("*").eq("user_id", user.id).maybeSingle();
  const bioIncomplete = isPresenterBioIncomplete(bio);

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
