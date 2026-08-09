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
import DashboardOnboarding from "@/components/DashboardOnboarding";
import { ASSET_GENERATORS, type GeneratorAssetType } from "@/lib/ai/generators";
import { AGENTS } from "@/lib/agents/config";
import { createProjectFromTemplate } from "@/lib/actions/projects";

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

  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("projects").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
  ]);

  const hasProjects = !!projects && projects.length > 0;

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
            {profile.credits_balance} / {profile.credits_monthly_allotment} credits this cycle · access
            until {formatDate(profile.access_expires_at)}
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
              href={`/projects/new?type=${type}`}
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
          {projects.map((project) => (
            <div
              key={project.id}
              className="card-elevated flex items-center gap-4 rounded-xl p-5 transition-colors hover:border-primary/40"
            >
              <div className="min-w-0 flex-1">
                <Link href={`/projects/${project.id}`} className="font-display text-lg font-semibold transition-colors hover:text-primary">
                  {project.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">Last edited {formatRelativeTime(project.updated_at)}</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/projects/${project.id}`}>
                  Open <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
