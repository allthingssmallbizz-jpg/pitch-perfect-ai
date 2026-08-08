import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import DashboardOnboarding from "@/components/DashboardOnboarding";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("projects").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <DashboardOnboarding hasProjects={!!projects && projects.length > 0} />
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gradient-silver">Your projects</h1>
          {profile && (
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.credits_balance} / {profile.credits_monthly_allotment} credits this cycle · access
              until {formatDate(profile.access_expires_at)}
            </p>
          )}
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New project
          </Link>
        </Button>
      </div>

      {!projects || projects.length === 0 ? (
        <div className="card-elevated rounded-2xl border-dashed p-10 text-center text-muted-foreground">
          No projects yet. Create one to start generating assets for your offer.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="card-elevated rounded-xl p-5 transition-colors hover:border-primary/40"
            >
              <h3 className="font-display font-semibold">{project.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {project.core_promise || project.desired_transformation || "No discovery notes yet."}
              </p>
              <p className="mt-3 text-xs text-muted-foreground/70">Updated {formatDate(project.updated_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
