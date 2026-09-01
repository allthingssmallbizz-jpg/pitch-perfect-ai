import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight, MonitorPlay, ScrollText, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ASSET_GENERATORS, WEB_PAGE_ASSET_TYPES, type GeneratorAssetType } from "@/lib/ai/generators";
import { AGENTS } from "@/lib/agents/config";
import { projectNeedsDiscovery } from "@/lib/projects";
import { isPresenterBioEmpty } from "@/lib/ai/presenterBio";
import { getPageStats, type PageStats } from "@/lib/analytics";
import AgentBadge from "@/components/AgentBadge";
import { Badge } from "@/components/ui/badge";
import GenerateClient from "./GenerateClient";

// Your Webinar and its Script share the same agent (Polly) — same name, same emoji, same title
// on both pages — which was exactly the problem: a member stepping away and coming back couldn't
// tell at a glance which one they'd landed on. This is a small, deliberately narrow icon lookup
// (not a full map for every generator) just for that one genuinely ambiguous pair.
const DELIVERABLE_ICON: Partial<Record<GeneratorAssetType, LucideIcon>> = {
  ppt_outline: MonitorPlay,
  webinar_script: ScrollText,
};

export default async function GenerateAssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; assetType: string }>;
  searchParams: Promise<{ generationId?: string }>;
}) {
  const { id, assetType } = await params;
  const { generationId } = await searchParams;

  if (!(assetType in ASSET_GENERATORS)) notFound();
  const generator = ASSET_GENERATORS[assetType as GeneratorAssetType];
  // Landing Page and Thank You Page both live under the "My Websites" hub, not a project's
  // Discovery page — so their back link always returns there, regardless of how someone
  // actually navigated in (My Websites, the sidebar, the matching-page toggle below, a fresh
  // "Generate matching Thank You Page"). Every other asset type still belongs to its project.
  const isWebPageAsset = WEB_PAGE_ASSET_TYPES.includes(generator.assetType);

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
    .is("deleted_at", null)
    .single();
  if (!project) notFound();

  // Only guard a fresh visit — if they're opening a specific past generation (?generationId=),
  // there's already real content to show regardless of the project's/account's current
  // completeness. Bio comes before Discovery in the required order (a member logging in with no
  // idea where to start asked "what do I do?" — Bio is the answer to that, Discovery the very
  // next one), so it's checked first: every agent needs both a strong presenter bio and a
  // complete discovery brief before it can generate anything (see the matching hard check in
  // /api/generate/route.ts, the real backstop this redirect exists to avoid most people ever
  // needing to hit).
  if (!generationId) {
    const { data: bio } = await supabase.from("presenter_bios").select("*").eq("user_id", user.id).maybeSingle();
    if (isPresenterBioEmpty(bio)) {
      redirect(`/bio?returnTo=${encodeURIComponent(`/projects/${id}/generate/${assetType}`)}`);
    }
  }
  if (!generationId && projectNeedsDiscovery(project)) {
    redirect(`/projects/${id}?intent=${assetType}`);
  }

  let initialContent: string | null = null;
  let initialGenerationId: string | null = null;
  let initialPublishSlug: string | null = null;
  let initialPublishedAt: string | null = null;

  if (generationId) {
    const { data: generation } = await supabase
      .from("generations")
      .select("*")
      .eq("id", generationId)
      .eq("project_id", id)
      .single();
    if (generation) {
      initialContent = generation.content;
      initialGenerationId = generation.id;
      initialPublishSlug = generation.publish_slug;
      initialPublishedAt = generation.published_at;
    }
  }

  // Every past run of *this* agent on *this* project — surfaced right here instead of only in
  // the project overview's mixed-asset-type History list, so re-opening or deleting a past
  // draft doesn't mean backing out to the project page and hunting for it.
  const { data: pastGenerationRows } = await supabase
    .from("generations")
    .select("id, content, status, created_at")
    .eq("project_id", id)
    .eq("asset_type", generator.assetType)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(30);

  // Landing Page's content is a real HTML document — raw tags would otherwise show up as
  // literal text in this preview snippet instead of readable copy.
  const pastGenerations = (pastGenerationRows ?? []).map((g) => {
    const raw = g.content ?? "";
    const cleaned = generator.assetType === "landing_page" ? raw.replace(/<[^>]*>/g, " ") : raw;
    return {
      id: g.id,
      createdAt: g.created_at,
      preview: cleaned.replace(/\s+/g, " ").trim().slice(0, 120),
    };
  });

  // The "other half" of this generator's pair in the same project — lets the toggle below jump
  // straight to it without backing out to the project page and hunting for it, since each pair is
  // meant to be viewed/edited together. Landing Page <-> Thank You Page was the original pair;
  // Your Webinar <-> Webinar Script is the same relationship for a different reason (Script is
  // generated FROM an existing deck, then a member had no way back to that deck except
  // regenerating it — see the chained-generation buttons in GenerateClient.tsx). null for every
  // other generator, which has no such pair.
  const MATCHING_ASSET_TYPE: Partial<Record<GeneratorAssetType, GeneratorAssetType>> = {
    landing_page: "thank_you_page",
    thank_you_page: "landing_page",
    ppt_outline: "webinar_script",
    webinar_script: "ppt_outline",
  };
  let matchingPage: { assetType: GeneratorAssetType; generationId: string } | null = null;
  const otherAssetType = MATCHING_ASSET_TYPE[generator.assetType];
  if (otherAssetType) {
    const { data: match } = await supabase
      .from("generations")
      .select("id")
      .eq("project_id", id)
      .eq("asset_type", otherAssetType)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (match) matchingPage = { assetType: otherAssetType, generationId: match.id };
  }

  // Views/leads/conversion % for the currently-open generation — only meaningful once it's been
  // published at least once, but computing it is cheap and the panel just shows zeros/dashes
  // otherwise (see PageStatsPanel in GenerateClient.tsx).
  let initialStats: PageStats | null = null;
  if (isWebPageAsset && initialGenerationId) {
    initialStats = await getPageStats(supabase, initialGenerationId);
  }

  const agent = AGENTS[generator.assetType];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href={isWebPageAsset ? "/websites" : `/projects/${id}`} className="text-sm text-primary hover:underline">
        ← {isWebPageAsset ? "My Websites" : project.name}
      </Link>
      <div className="mt-4 mb-1 flex flex-wrap items-center justify-between gap-3">
        <AgentBadge agent={agent} size="lg" showTagline />
        {matchingPage && (
          <Link
            href={`/projects/${id}/generate/${matchingPage.assetType}?generationId=${matchingPage.generationId}`}
            className={
              // Deliberately red-on-white for the Your Webinar <-> Webinar Script toggle
              // specifically — the request was "I had to go looking for it," and this pair shares
              // one agent identity across both pages (see the icon-badge comment above), so this
              // is the one toggle that most needs to visually shout instead of blend in. Landing
              // Page <-> Thank You Page reuses the same matchingPage mechanism but wasn't part of
              // that complaint, so it keeps its original quieter neutral styling.
              generator.assetType === "ppt_outline" || generator.assetType === "webinar_script"
                ? "flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500"
                : "flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            }
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            View {AGENTS[matchingPage.assetType].name}&apos;s {ASSET_GENERATORS[matchingPage.assetType].label}
          </Link>
        )}
      </div>
      {/* A bold, colored badge rather than the small muted-gray line this used to be — the plain
          agent badge above reads identically ("Agent Polly, The Pitch Deck Pro") whether this is
          Your Webinar or its Script, so this is the thing that actually says which one is on
          screen at a glance, even after stepping away and coming back to it later. */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge className="gap-1.5 px-3 py-1 text-sm">
          {(() => {
            const Icon = DELIVERABLE_ICON[generator.assetType];
            return Icon ? <Icon className="h-3.5 w-3.5" /> : null;
          })()}
          {generator.label}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {generator.creditCost} credits per generation · {project.mode} mode
        </span>
      </div>

      <GenerateClient
        // Forces a full remount whenever the open generation changes (a fresh visit, opening a
        // past run, or a just-completed Regenerate updating the URL) — without this, switching
        // to a different generation via the "Past generations" list only ever changes the URL,
        // since useState(initialContent) etc. don't re-run their initializer on a prop change
        // alone. Same fix already applied to HeadlineLabClient for the identical symptom.
        key={initialGenerationId ?? "new"}
        projectId={id}
        assetType={generator.assetType}
        mode={project.mode}
        initialContent={initialContent}
        initialGenerationId={initialGenerationId}
        projectFunnelType={project.funnel_type}
        initialPublishSlug={initialPublishSlug}
        initialPublishedAt={initialPublishedAt}
        initialStats={initialStats}
        initialPastGenerations={pastGenerations}
      />
    </div>
  );
}
