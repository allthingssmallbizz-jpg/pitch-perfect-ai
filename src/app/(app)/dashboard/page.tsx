import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ArrowRight,
  Rocket,
  Presentation,
  Video,
  FileText,
  MonitorPlay,
  Layout,
  Mail,
  Megaphone,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { Undo2 } from "lucide-react";
import DashboardOnboarding from "@/components/DashboardOnboarding";
import DeleteProjectButton from "@/components/DeleteProjectButton";
import { ASSET_GENERATORS, type GeneratorAssetType } from "@/lib/ai/generators";
import { AGENTS } from "@/lib/agents/config";
import { createProjectFromTemplate, restoreProject } from "@/lib/actions/projects";
import { formatCreditsLabel } from "@/lib/credits";
import { getAssetHref } from "@/lib/ai/assetLabels";
import { projectNeedsDiscovery } from "@/lib/projects";
import type { AssetType } from "@/types/database";

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

// Same 8 generators, same order, as the sidebar's "Create" group (AppSidebar.tsx) — kept as a
// separate local list rather than a shared import since AppSidebar is a client component and
// this page is a server component.
const DELIVERABLE_TYPES: GeneratorAssetType[] = [
  "webinar_outline",
  "vsl_script",
  "sales_page",
  "ppt_outline",
  "landing_page",
  "email_sequence",
  "ad_copy",
  "offer_ladder",
];

const DELIVERABLE_ICONS: Record<GeneratorAssetType, LucideIcon> = {
  webinar_outline: Presentation,
  vsl_script: Video,
  sales_page: FileText,
  ppt_outline: MonitorPlay,
  landing_page: Layout,
  email_sequence: Mail,
  ad_copy: Megaphone,
  offer_ladder: Layers,
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: projects, error: projectsError },
    { data: latestGenerationRows },
    { data: deletedProjects },
  ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }),
      // Most recent completed generation per project, so a project card on the dashboard can jump
      // straight into whatever was actually built there instead of always landing on the overview
      // — the overview (discovery review) is only useful while there's nothing to open yet.
      supabase
        .from("generations")
        .select("id, project_id, asset_type, created_at")
        .eq("user_id", user.id)
        .eq("status", "complete")
        .not("project_id", "is", null)
        .order("created_at", { ascending: false }),
      // Soft-deleted projects (see updateProjectDiscovery/deleteProject comments and
      // supabase/migrations/0013_project_soft_delete.sql) — surfaced here so a delete, accidental
      // or not, is a one-click undo instead of permanent.
      supabase
        .from("projects")
        .select("id, name, deleted_at")
        .eq("user_id", user.id)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(20),
    ]);

  // A real query failure (e.g. a migration that added a filtered-on column, like deleted_at,
  // not yet run against this database) used to look identical to "you have no projects" —
  // nobody destructured `error`. Logging it at least leaves a trace in server logs instead of
  // silently rendering the empty state.
  if (projectsError) console.error("DashboardPage: projects query failed", projectsError);

  const hasProjects = !!projects && projects.length > 0;

  // Ordered by created_at desc above, so the first row seen for a given project_id is that
  // project's most recent generation.
  const latestGenerationByProject = new Map<string, { id: string; assetType: AssetType }>();
  for (const g of latestGenerationRows ?? []) {
    if (g.project_id && !latestGenerationByProject.has(g.project_id)) {
      latestGenerationByProject.set(g.project_id, { id: g.id, assetType: g.asset_type });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <DashboardOnboarding hasProjects={hasProjects} />

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary/80">Create</div>
          <h1 className="font-display text-3xl font-bold text-gradient-silver">What are you building today?</h1>
          <p className="mt-1 text-muted-foreground">
            Choose your agent — Pitch Perfect AI will guide you the rest of the way.
          </p>
        </div>
        {profile && (
          <p className="text-sm text-muted-foreground">
            {formatCreditsLabel(profile)} credits this cycle · access until {formatDate(profile.access_expires_at)}
          </p>
        )}
      </div>

      <div className="mb-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DELIVERABLE_TYPES.map((type) => {
          const generator = ASSET_GENERATORS[type];
          const agent = AGENTS[type];
          const Icon = DELIVERABLE_ICONS[type];
          return (
            <Link
              key={type}
              href={`/agents/${type}`}
              className="card-elevated group rounded-2xl p-6 transition-colors hover:border-primary/50"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold uppercase tracking-wide text-primary">
                    {agent.emoji} {agent.name}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">{agent.title}</div>
                </div>
              </div>
              <h3 className="font-display text-lg font-semibold">{generator.label}</h3>
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{generator.description}</p>
              <div className="mt-4 inline-flex items-center text-sm text-primary">
                Start <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Your projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">Every pitch you&apos;ve built, one click away.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New project
          </Link>
        </Button>
      </div>

      {projectsError && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Couldn&apos;t load your projects right now — this is a loading error, not an empty
          account. Refresh the page; if it keeps happening, this needs a look at the server logs.
        </p>
      )}

      {!hasProjects ? (
        <div className="card-elevated rounded-2xl p-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">No projects yet</h3>
          <p className="mt-2 mb-6 text-muted-foreground">
            See what the AI can do in under 60 seconds — or start from scratch.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <form action={createProjectFromTemplate}>
              <input type="hidden" name="templateId" value="coach-2k-program" />
              <Button type="submit">
                <Rocket className="mr-2 h-4 w-4" />
                Try a sample project
              </Button>
            </form>
            <Button variant="outline" asChild>
              <Link href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                Start from scratch
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => {
            const latestGeneration = latestGenerationByProject.get(project.id);
            // Discovery incomplete always wins — even if something was generated earlier, the
            // brief may have been edited since (fields aren't locked after generating) and no
            // longer reflects what a regenerate would need. Only once discovery is complete does
            // a finished generation take priority over the overview; with nothing generated yet,
            // land on the overview either way since there's nothing to open.
            const href = projectNeedsDiscovery(project)
              ? `/projects/${project.id}`
              : latestGeneration
                ? getAssetHref(project.id, latestGeneration.assetType, latestGeneration.id)
                : `/projects/${project.id}`;
            return (
              <div
                key={project.id}
                className="card-elevated flex items-center gap-4 rounded-xl p-5 transition-colors hover:border-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <Link href={href} className="font-display text-lg font-semibold transition-colors hover:text-primary">
                    {project.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">Last edited {formatRelativeTime(project.updated_at)}</p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={href}>
                    Open <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <DeleteProjectButton projectId={project.id} projectName={project.name} />
              </div>
            );
          })}
        </div>
      )}

      {deletedProjects && deletedProjects.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground hover:text-foreground">
            Recently deleted ({deletedProjects.length})
          </summary>
          <div className="mt-3 grid gap-2">
            {deletedProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card/30 px-4 py-2.5"
              >
                <span className="min-w-0 truncate text-sm text-muted-foreground">{project.name}</span>
                <form action={restoreProject}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <Button type="submit" variant="outline" size="sm">
                    <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                    Restore
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
