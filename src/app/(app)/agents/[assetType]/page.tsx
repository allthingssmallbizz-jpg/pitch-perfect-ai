import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ASSET_GENERATORS, type GeneratorAssetType } from "@/lib/ai/generators";
import { AGENTS } from "@/lib/agents/config";
import AgentBadge from "@/components/AgentBadge";
import DeleteGenerationButton from "@/components/DeleteGenerationButton";
import { Button } from "@/components/ui/button";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Top-level entry point for each generator agent — the sidebar's "Create" links and the
// dashboard's deliverable grid land here instead of straight into /projects/new, mirroring
// /analyze's landing page (built for the same reason: re-opening past work shouldn't force
// creating a brand-new project every time you click an agent). Unlike /analyze, this also
// aggregates generations across every project this agent has ever run in, since a generator
// like Ad Copy is used across many different offers/projects, not one at a time.
export default async function AgentLandingPage({
  params,
}: {
  params: Promise<{ assetType: string }>;
}) {
  const { assetType } = await params;
  if (!(assetType in ASSET_GENERATORS)) notFound();
  const generator = ASSET_GENERATORS[assetType as GeneratorAssetType];
  const agent = AGENTS[generator.assetType];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: projects }, { data: generations }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase
      .from("generations")
      .select("id, project_id, content, created_at")
      .eq("user_id", user.id)
      .eq("asset_type", generator.assetType)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // No FK-relationship typing on the hand-written Database type (Relationships: [] on every
  // table — see types/database.ts), so this joins project names onto generations in JS rather
  // than a nested/embedded select.
  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const pastGenerations = (generations ?? [])
    .filter((g) => g.project_id && projectNameById.has(g.project_id))
    .map((g) => ({
      id: g.id,
      projectId: g.project_id as string,
      projectName: projectNameById.get(g.project_id as string) ?? "Untitled project",
      preview: (g.content ?? "").replace(/\s+/g, " ").trim().slice(0, 140),
      createdAt: g.created_at,
    }));

  const hasProjects = !!projects && projects.length > 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-1">
        <AgentBadge agent={agent} size="lg" showTagline />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        {generator.description} · {generator.creditCost} credits per generation
      </p>

      <Link
        href={`/projects/new?type=${generator.assetType}`}
        className="card-elevated mb-8 flex items-center justify-between rounded-2xl border-dashed p-6 transition-colors hover:border-primary/50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-display font-semibold">Start a new project</div>
            <div className="text-sm text-muted-foreground">Name a project and fill in its discovery brief.</div>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-primary" />
      </Link>

      {hasProjects && (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Or generate for an existing project
          </h2>
          <div className="mb-8 grid gap-2 sm:grid-cols-2">
            {projects!.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}/generate/${generator.assetType}`}
                className="card-elevated rounded-xl p-3 text-sm font-medium transition-colors hover:border-primary/40"
              >
                {p.name}
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Past generations
      </h2>
      {pastGenerations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing generated with {agent.name} yet — start above and it&apos;ll show up here.
        </p>
      ) : (
        <div className="grid gap-3">
          {pastGenerations.map((g) => {
            const href = `/projects/${g.projectId}/generate/${generator.assetType}?generationId=${g.id}`;
            return (
              <div
                key={g.id}
                className="card-elevated flex items-center gap-4 rounded-xl p-5 transition-colors hover:border-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <Link href={href} className="font-display text-base font-semibold transition-colors hover:text-primary">
                    {g.projectName}
                  </Link>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{g.preview || "(empty)"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatRelativeTime(g.createdAt)}</p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={href}>
                    Open <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <DeleteGenerationButton generationId={g.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
