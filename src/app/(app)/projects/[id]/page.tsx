import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ASSET_GENERATORS, ASSET_TYPES } from "@/lib/ai/generators";
import { getAssetLabel, getAssetHref } from "@/lib/ai/assetLabels";
import { ANALYZER_CREDIT_COST } from "@/lib/ai/analyzer";
import { AD_IMAGE_CREDIT_COST } from "@/lib/ai/generators/adImage";
import { AGENTS, getAgent } from "@/lib/agents/config";
import { Badge } from "@/components/ui/badge";
import AgentBadge from "@/components/AgentBadge";
import DiscoveryForm from "./DiscoveryForm";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ intent?: string }>;
}) {
  const { id } = await params;
  const { intent } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!project) notFound();

  // Set when this project was just created from a specific agent (sidebar/dashboard "Create"
  // links land on ?intent=webinar_outline instead of skipping straight to the generator — see
  // the comment on projectDestination in src/lib/actions/projects.ts). Used to highlight which
  // tool the user actually wanted and to send DiscoveryForm's "Save" straight there.
  const isValidIntent =
    intent === "presentation_analysis" || intent === "ad_image" || (intent && (ASSET_TYPES as string[]).includes(intent));
  // "ad_image" isn't a key in AGENTS (it's Addie's sub-capability, not a separate agent
  // identity — see the comment on AgentAssetType) so it needs its own lookup here.
  const intentAgent = !isValidIntent ? null : intent === "ad_image" ? AGENTS.ad_copy : AGENTS[intent as keyof typeof AGENTS];
  const intentHref = !isValidIntent
    ? null
    : intent === "presentation_analysis"
      ? `/projects/${id}/analyze`
      : intent === "ad_image"
        ? `/projects/${id}/ad-image`
        : `/projects/${id}/generate/${intent}`;

  const { data: generations } = await supabase
    .from("generations")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/dashboard" className="text-sm text-primary hover:underline">
        ← All projects
      </Link>
      <h1 className="mt-2 mb-6 font-display text-2xl font-semibold text-gradient-silver">{project.name}</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Discovery
          </h2>
          {intentAgent && (
            <p className="mb-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-muted-foreground">
              Fill in the brief below, then Save takes you straight to {intentAgent.emoji}{" "}
              <span className="font-medium text-foreground">{intentAgent.name}</span>.
            </p>
          )}
          <DiscoveryForm project={project} redirectTo={intentHref} />
        </div>

        <div className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your AI marketing team
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ASSET_TYPES.map((type) => {
              const gen = ASSET_GENERATORS[type];
              const agent = AGENTS[type];
              return (
                <Link
                  key={type}
                  href={`/projects/${project.id}/generate/${type}`}
                  className={`card-elevated rounded-xl p-4 transition-colors hover:border-primary/40 ${
                    intent === type ? "border-primary/60 ring-1 ring-primary/40" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <AgentBadge agent={agent} size="sm" />
                    <Badge variant="secondary" className="shrink-0">
                      {gen.creditCost} credits
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{gen.description}</p>
                </Link>
              );
            })}
          </div>

          <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Image ads
          </h2>
          <Link
            href={`/projects/${project.id}/ad-image`}
            className={`card-elevated block rounded-xl p-4 transition-colors hover:border-primary/40 ${
              intent === "ad_image" ? "border-primary/60 ring-1 ring-primary/40" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <AgentBadge agent={AGENTS.ad_copy} size="sm" />
              <Badge variant="secondary" className="shrink-0">
                {AD_IMAGE_CREDIT_COST} credits
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload a photo and Addie writes the headline, subheadline, and CTA, then overlays
              them onto it — a finished, downloadable ad image.
            </p>
          </Link>

          <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Analyze a presentation
          </h2>
          <Link
            href={`/projects/${project.id}/analyze`}
            className={`card-elevated block rounded-xl p-4 transition-colors hover:border-primary/40 ${
              intent === "presentation_analysis" ? "border-primary/60 ring-1 ring-primary/40" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <AgentBadge agent={AGENTS.presentation_analysis} size="sm" />
              <Badge variant="secondary" className="shrink-0">
                {ANALYZER_CREDIT_COST} credits
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Paste or upload a webinar, VSL, sales presentation, investor pitch, or short-form
              video (YouTube, Instagram, TikTok) and get a 19-point conversion-readiness
              critique with scores, missing components, and a prioritized fix list.
            </p>
          </Link>

          <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            History
          </h2>
          {!generations || generations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No generations yet.</p>
          ) : (
            <ul className="space-y-2">
              {generations.map((g) => (
                <li key={g.id}>
                  <Link
                    href={getAssetHref(project.id, g.asset_type, g.id)}
                    className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-4 py-2 text-sm transition-colors hover:border-primary/40"
                  >
                    <span>
                      {getAgent(g.asset_type) ? `${getAgent(g.asset_type)!.emoji} ` : ""}
                      {getAssetLabel(g.asset_type)}{" "}
                      <span className="text-muted-foreground">· {g.mode}</span>
                    </span>
                    <span
                      className={
                        g.status === "complete"
                          ? "text-emerald-400"
                          : g.status === "failed"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {g.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
