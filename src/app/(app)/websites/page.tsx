import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AGENTS } from "@/lib/agents/config";
import { ASSET_GENERATORS, WEB_PAGE_ASSET_TYPES, type GeneratorAssetType } from "@/lib/ai/generators";
import DeleteGenerationButton from "@/components/DeleteGenerationButton";
import WebsiteRowActions from "@/components/WebsiteRowActions";
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

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// Account-level library of every real webpage ever generated — Landing Pages and Thank You
// Pages both live here in one place across every project, since a member managing several
// offers otherwise has no way to see "all my websites" without opening each project one at a
// time. Reuses the same "Open" href (?generationId=...) that /agents/[assetType] and
// GenerateClient already treat as "load this saved result directly" — no new routing concept.
export default async function WebsitesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: projects, error: projectsError }, { data: generations, error: generationsError }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("user_id", user.id).is("deleted_at", null),
    supabase
      .from("generations")
      .select("id, project_id, asset_type, content, created_at")
      .eq("user_id", user.id)
      .in("asset_type", WEB_PAGE_ASSET_TYPES)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (projectsError) console.error("WebsitesPage: projects query failed", projectsError);
  if (generationsError) console.error("WebsitesPage: generations query failed", generationsError);
  const loadFailed = Boolean(projectsError || generationsError);
  const loadErrorDetail = [projectsError?.message, generationsError?.message].filter(Boolean).join(" / ");

  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const websites = (generations ?? [])
    .filter((g) => g.project_id && projectNameById.has(g.project_id) && g.content)
    .map((g) => {
      const assetType = g.asset_type as GeneratorAssetType;
      return {
        id: g.id,
        projectId: g.project_id as string,
        projectName: projectNameById.get(g.project_id as string) ?? "Untitled project",
        assetType,
        content: g.content as string,
        preview: stripHtmlTags(g.content as string).slice(0, 140),
        createdAt: g.created_at,
      };
    });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold">My Websites</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Every Landing Page and Thank You Page you&apos;ve generated, across every project, in one place.
      </p>

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <Link
          href="/projects/new?type=landing_page"
          className="card-elevated flex items-center justify-between rounded-2xl border-dashed p-5 transition-colors hover:border-primary/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-display font-semibold">New Landing Page</div>
              <div className="text-sm text-muted-foreground">{AGENTS.landing_page.tagline}</div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-primary" />
        </Link>
        <Link
          href="/projects/new?type=thank_you_page"
          className="card-elevated flex items-center justify-between rounded-2xl border-dashed p-5 transition-colors hover:border-primary/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-display font-semibold">New Thank You Page</div>
              <div className="text-sm text-muted-foreground">{AGENTS.thank_you_page.tagline}</div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-primary" />
        </Link>
      </div>

      {loadFailed ? (
        <p className="text-sm text-destructive">
          Couldn&apos;t load your websites right now — this is a loading error, not an empty list.
          {loadErrorDetail && (
            <span className="mt-1 block rounded bg-destructive/10 px-2 py-1 font-mono text-xs">{loadErrorDetail}</span>
          )}
        </p>
      ) : websites.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing generated yet — build one above and it&apos;ll show up here.</p>
      ) : (
        <div className="grid gap-3">
          {websites.map((w) => {
            const generator = ASSET_GENERATORS[w.assetType];
            const agent = AGENTS[w.assetType];
            const href = `/projects/${w.projectId}/generate/${w.assetType}?generationId=${w.id}`;
            const filename = w.assetType === "thank_you_page" ? "thank-you-page.html" : "landing-page.html";
            return (
              <div
                key={w.id}
                className="card-elevated flex items-center gap-3 rounded-xl p-5 transition-colors hover:border-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={href} className="font-display text-base font-semibold transition-colors hover:text-primary">
                      {w.projectName}
                    </Link>
                    <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      <span aria-hidden>{agent.emoji}</span> {generator.label}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{w.preview || "(empty)"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatRelativeTime(w.createdAt)}</p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={href}>
                    Open <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <WebsiteRowActions content={w.content} filename={filename} />
                <DeleteGenerationButton generationId={w.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
