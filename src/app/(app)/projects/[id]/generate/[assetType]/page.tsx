import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ASSET_GENERATORS, type GeneratorAssetType } from "@/lib/ai/generators";
import { AGENTS } from "@/lib/agents/config";
import { projectNeedsDiscovery } from "@/lib/projects";
import { isPresenterBioEmpty } from "@/lib/ai/presenterBio";
import AgentBadge from "@/components/AgentBadge";
import GenerateClient from "./GenerateClient";
import BioReminderDialog from "./BioReminderDialog";

// The two asset types this reminder applies to — "before anyone starts their webinar or sales
// video" — not every generator, since the presenter-bio beats (Credibility Bridge, Opening
// Story) are specifically things Webinar Outline and VSL Script build in.
const BIO_RELEVANT_ASSET_TYPES = new Set(["webinar_outline", "vsl_script"]);

export default async function GenerateAssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; assetType: string }>;
  searchParams: Promise<{ generationId?: string; from?: string }>;
}) {
  const { id, assetType } = await params;
  const { generationId, from } = await searchParams;
  // The My Websites page (src/app/(app)/websites/page.tsx) links here with "&from=websites" when
  // opening an already-generated page — "back" should return there, not to the project's
  // Discovery page, since that's not actually where the person came from in that flow.
  const cameFromWebsites = from === "websites";

  if (!(assetType in ASSET_GENERATORS)) notFound();
  const generator = ASSET_GENERATORS[assetType as GeneratorAssetType];

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

  // A nudge, not a hard gate — the bio stays optional, so this only shows on a fresh visit to
  // Webinar/VSL specifically (the two assets whose Credibility Bridge/Opening Story beats
  // actually use it) and reappears every time until the bio is filled in.
  let showBioReminder = false;
  if (!generationId && BIO_RELEVANT_ASSET_TYPES.has(assetType)) {
    const { data: bio } = await supabase.from("presenter_bios").select("*").eq("user_id", user.id).maybeSingle();
    showBioReminder = isPresenterBioEmpty(bio);
  }

  let initialContent: string | null = null;
  let initialGenerationId: string | null = null;

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

  const agent = AGENTS[generator.assetType];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href={cameFromWebsites ? "/websites" : `/projects/${id}`}
        className="text-sm text-primary hover:underline"
      >
        ← {cameFromWebsites ? "My Websites" : project.name}
      </Link>
      <div className="mt-4 mb-1">
        <AgentBadge agent={agent} size="lg" showTagline />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        {generator.label} · {generator.creditCost} credits per generation · {project.mode} mode
      </p>

      {showBioReminder && <BioReminderDialog />}

      <GenerateClient
        projectId={id}
        assetType={generator.assetType}
        mode={project.mode}
        initialContent={initialContent}
        initialGenerationId={initialGenerationId}
        initialPastGenerations={pastGenerations}
      />
    </div>
  );
}
