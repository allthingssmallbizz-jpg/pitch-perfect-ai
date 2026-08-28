import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ASSET_GENERATORS, type GeneratorAssetType } from "@/lib/ai/generators";
import { AGENTS } from "@/lib/agents/config";
import { isPresenterBioEmpty } from "@/lib/ai/presenterBio";
import AgentBadge from "@/components/AgentBadge";
import DeleteGenerationButton from "@/components/DeleteGenerationButton";
import BioReminderDialog from "@/components/BioReminderDialog";
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

  const isAddie = generator.assetType === "ad_copy";

  const [
    { data: projects, error: projectsError },
    { data: generations, error: generationsError },
    { data: imageAdRows },
    { data: bio },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    supabase
      .from("generations")
      .select("id, project_id, content, created_at")
      .eq("user_id", user.id)
      .eq("asset_type", generator.assetType)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(50),
    // Addie's Image Ads is a sub-capability, not its own agent/generator entry (see the
    // comment on AgentAssetType) — only fetched on her own landing page.
    isAddie
      ? supabase
          .from("generations")
          .select("id, project_id, content, image_result_path, created_at")
          .eq("user_id", user.id)
          .eq("asset_type", "ad_image")
          .eq("status", "complete")
          .order("created_at", { ascending: false })
          .limit(24)
      : Promise.resolve({ data: null }),
    // Fetched here rather than only on the generate page — this landing page is the actual
    // moment someone "clicks on an agent," so the nudge to finish the bio first belongs here,
    // before they even pick a project, not several clicks later.
    supabase.from("presenter_bios").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  const showBioReminder = isPresenterBioEmpty(bio);

  // Neither of these queries should ever actually fail for a normal request — but they used to
  // be destructured without looking at `error` at all, so a real failure (a missing column after
  // a migration hasn't been run yet, a transient RLS/auth hiccup) silently produced the exact
  // same empty result as "genuinely nothing generated yet," with no trace anywhere. Logging here
  // means a real failure shows up in server logs instead of just looking like empty history.
  if (projectsError) console.error(`AgentLandingPage(${generator.assetType}): projects query failed`, projectsError);
  if (generationsError)
    console.error(`AgentLandingPage(${generator.assetType}): generations query failed`, generationsError);
  const loadFailed = Boolean(projectsError || generationsError);
  // Shown directly on the page (not just logged) since there's no way to hand the person hitting
  // this a Vercel server-log link — Postgrest's error text (a missing column/table, an RLS
  // denial reason) isn't sensitive and is the fastest path to actually diagnosing this remotely.
  const loadErrorDetail = [projectsError?.message, generationsError?.message].filter(Boolean).join(" / ");

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

  const imageResultPaths = (imageAdRows ?? []).map((r) => r.image_result_path).filter((p): p is string => !!p);
  const { data: signedImageUrls } = imageResultPaths.length
    ? await supabase.storage.from("ad-images").createSignedUrls(imageResultPaths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const signedImageUrlByPath = new Map((signedImageUrls ?? []).map((s) => [s.path, s.signedUrl]));

  const pastImageAds = (imageAdRows ?? [])
    .filter((g) => g.project_id && projectNameById.has(g.project_id))
    .map((g) => {
      let headline = "";
      try {
        if (g.content) headline = JSON.parse(g.content).headline ?? "";
      } catch {
        // ignore malformed content
      }
      return {
        id: g.id,
        projectId: g.project_id as string,
        projectName: projectNameById.get(g.project_id as string) ?? "Untitled project",
        headline,
        createdAt: g.created_at,
        thumbnailUrl: g.image_result_path ? (signedImageUrlByPath.get(g.image_result_path) ?? null) : null,
      };
    });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {showBioReminder && <BioReminderDialog />}

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

      {isAddie && (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Image ads
          </h2>
          <Link
            href="/projects/new?type=ad_image"
            className="card-elevated mb-3 flex items-center justify-between rounded-2xl border-dashed p-4 transition-colors hover:border-primary/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-display font-semibold">Create an image ad</div>
                <div className="text-sm text-muted-foreground">
                  Upload a photo — Addie writes the headline, subheadline, and CTA and overlays them onto it.
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary" />
          </Link>
          {pastImageAds.length > 0 && (
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {pastImageAds.map((g) => (
                <div key={g.id} className="card-elevated overflow-hidden rounded-xl">
                  <Link href={`/projects/${g.projectId}/ad-image?generationId=${g.id}`} className="block">
                    {g.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a signed Supabase Storage URL
                      <img src={g.thumbnailUrl} alt={g.headline || "Ad"} className="aspect-square w-full object-cover" />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-card/40 text-xs text-muted-foreground">
                        No preview
                      </div>
                    )}
                  </Link>
                  <div className="p-2">
                    <p className="truncate text-xs text-muted-foreground">{g.projectName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Past generations
      </h2>
      {/* These always carry ?generationId=, which the generate page treats as "open this saved
          result" — it skips the discovery gate entirely and shows the content directly, no
          regenerate prompt. Only "Start a new project" above goes through discovery first. */}
      {loadFailed ? (
        <p className="text-sm text-destructive">
          Couldn&apos;t load past generations right now — this is a loading error, not an empty
          list.
          {loadErrorDetail && (
            <span className="mt-1 block rounded bg-destructive/10 px-2 py-1 font-mono text-xs">
              {loadErrorDetail}
            </span>
          )}
        </p>
      ) : pastGenerations.length === 0 ? (
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
