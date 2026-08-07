import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ASSET_GENERATORS, type GeneratorAssetType } from "@/lib/ai/generators";
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
    .single();
  if (!project) notFound();

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

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href={`/projects/${id}`} className="text-sm text-primary hover:underline">
        ← {project.name}
      </Link>
      <h1 className="mt-2 mb-1 font-display text-2xl font-semibold text-gradient-silver">{generator.label}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {generator.description} · {generator.creditCost} credits per generation · {project.mode} mode
      </p>

      <GenerateClient
        projectId={id}
        assetType={generator.assetType}
        mode={project.mode}
        initialContent={initialContent}
        initialGenerationId={initialGenerationId}
      />
    </div>
  );
}
