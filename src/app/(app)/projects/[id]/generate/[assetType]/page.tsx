import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ASSET_GENERATORS, WEB_PAGE_ASSET_TYPES, type GeneratorAssetType } from "@/lib/ai/generators";
import { AGENTS } from "@/lib/agents/config";
import { projectNeedsDiscovery } from "@/lib/projects";
import { isPresenterBioEmpty } from "@/lib/ai/presenterBio";
import { getPageStats, type PageStats } from "@/lib/analytics";
import AgentBadge from "@/components/AgentBadge";
import GenerateClient from "./GenerateClient";
import BioReminderDialog from "@/components/BioReminderDialog";

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
  // there's already real content to show regardless of the project's current discovery state.
  if (!generationId && projectNeedsDiscovery(project)) {
    redirect(`/projects/${id}?intent=${assetType}`);
  }

  // A nudge, not a hard gate — the bio stays optional. Applies to every generator, not just
  // Webinar/VSL, since getPresenterBioBlock folds the bio into every generation's system prompt
  // (see /api/generate/route.ts) regardless of asset type. Only shows on a fresh visit (not when
  // reopening a past generation) and reappears every time until the bio is filled in — the agent
  // landing page (src/app/(app)/agents/[assetType]/page.tsx) shows the same reminder even
  // earlier, the moment someone clicks into an agent at all, so this mainly covers landing here
  // some other way (e.g. the dashboard's deliverable grid, a bookmarked URL).
  let showBioReminder = false;
  if (!generationId) {
    const { data: bio } = await supabase.from("presenter_bios").select("*").eq("user_id", user.id).maybeSingle();
    showBioReminder = isPresenterBioEmpty(bio);
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
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            View {AGENTS[matchingPage.assetType].name}&apos;s {ASSET_GENERATORS[matchingPage.assetType].label}
          </Link>
        )}
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        {generator.label} · {generator.creditCost} credits per generation · {project.mode} mode
      </p>

      {showBioReminder && <BioReminderDialog />}

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
