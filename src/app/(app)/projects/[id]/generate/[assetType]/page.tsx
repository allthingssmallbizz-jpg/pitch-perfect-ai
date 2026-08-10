import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ASSET_GENERATORS, type GeneratorAssetType } from "@/lib/ai/generators";
import { AGENTS } from "@/lib/agents/config";
import { projectNeedsDiscovery } from "@/lib/projects";
import AgentBadge from "@/components/AgentBadge";
import GenerateClient from "./GenerateClient";

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

  const pastGenerations = (pastGenerationRows ?? []).map((g) => ({
    id: g.id,
    createdAt: g.created_at,
    preview: (g.content ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
  }));

  const agent = AGENTS[generator.assetType];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href={`/projects/${id}`} className="text-sm text-primary hover:underline">
        ← {project.name}
      </Link>
      <div className="mt-4 mb-1">
        <AgentBadge agent={agent} size="lg" showTagline />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        {generator.label} · {generator.creditCost} credits per generation · {project.mode} mode
      </p>

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
