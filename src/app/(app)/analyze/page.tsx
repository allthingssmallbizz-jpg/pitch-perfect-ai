import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AGENTS } from "@/lib/agents/config";
import { ANALYZER_CREDIT_COST } from "@/lib/ai/analyzer";
import AgentBadge from "@/components/AgentBadge";
import DeleteProjectButton from "@/components/DeleteProjectButton";
import { Button } from "@/components/ui/button";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

// Top-level entry point for Agent Annie — the sidebar's "Analyzer" link lands here instead of
// straight into /projects/new, so re-opening a project you've already analyzed doesn't force
// creating a brand new one every time.
export default async function AnalyzeLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const hasProjects = !!projects && projects.length > 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-1">
        <AgentBadge agent={AGENTS.presentation_analysis} size="lg" showTagline />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        19-point conversion-readiness critique · text or full video upload · {ANALYZER_CREDIT_COST}{" "}
        credits per text analysis
      </p>

      <Link
        href="/projects/new?type=presentation_analysis"
        className="card-elevated mb-8 flex items-center justify-between rounded-2xl border-dashed p-6 transition-colors hover:border-primary/50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-display font-semibold">Analyze a new project</div>
            <div className="text-sm text-muted-foreground">Name a project and jump straight into the analyzer.</div>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-primary" />
      </Link>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Or pick up a previous project
      </h2>

      {!hasProjects ? (
        <p className="text-sm text-muted-foreground">
          No projects yet — start one above and it&apos;ll show up here next time.
        </p>
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="card-elevated flex items-center gap-4 rounded-xl p-5 transition-colors hover:border-primary/40"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/projects/${project.id}/analyze`}
                  className="font-display text-lg font-semibold transition-colors hover:text-primary"
                >
                  {project.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">Last edited {formatRelativeTime(project.updated_at)}</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/projects/${project.id}/analyze`}>
                  Open <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <DeleteProjectButton projectId={project.id} redirectTo="/analyze" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
