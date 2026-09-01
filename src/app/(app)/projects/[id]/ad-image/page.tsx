import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AGENTS } from "@/lib/agents/config";
import { projectNeedsDiscovery } from "@/lib/projects";
import { isPresenterBioIncomplete } from "@/lib/ai/presenterBio";
import { AD_IMAGE_CREDIT_COST } from "@/lib/ai/generators/adImage";
import AgentBadge from "@/components/AgentBadge";
import AdImageClient, { type PastAdImage } from "./AdImageClient";

export default async function AdImagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generationId?: string }>;
}) {
  const { id } = await params;
  const { generationId } = await searchParams;

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

  // Bio before Discovery before any agent — same gate, same order, as generate/[assetType]/page.tsx.
  if (!generationId) {
    const { data: bio } = await supabase.from("presenter_bios").select("*").eq("user_id", user.id).maybeSingle();
    if (isPresenterBioIncomplete(bio)) {
      redirect(`/bio?returnTo=${encodeURIComponent(`/projects/${id}/ad-image`)}`);
    }
  }
  if (!generationId && projectNeedsDiscovery(project)) {
    redirect(`/projects/${id}?intent=ad_image`);
  }

  const { data: rows } = await supabase
    .from("generations")
    .select("id, content, image_source_path, image_result_path, created_at")
    .eq("project_id", id)
    .eq("asset_type", "ad_image")
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(20);

  const resultPaths = (rows ?? []).map((r) => r.image_result_path).filter((p): p is string => !!p);
  const { data: signedUrls } = resultPaths.length
    ? await supabase.storage.from("ad-images").createSignedUrls(resultPaths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const signedUrlByPath = new Map((signedUrls ?? []).map((s) => [s.path, s.signedUrl]));

  const pastGenerations: PastAdImage[] = (rows ?? []).map((r) => {
    let copy = { headline: "", subheadline: "", cta: "" };
    try {
      if (r.content) copy = JSON.parse(r.content);
    } catch {
      // Malformed content shouldn't crash the list — just show blanks for that entry.
    }
    return {
      id: r.id,
      createdAt: r.created_at,
      copy,
      thumbnailUrl: r.image_result_path ? (signedUrlByPath.get(r.image_result_path) ?? null) : null,
    };
  });

  const initial = generationId ? pastGenerations.find((g) => g.id === generationId) ?? null : null;

  const agent = AGENTS.ad_copy;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href={`/projects/${id}`} className="text-sm text-primary hover:underline">
        ← {project.name}
      </Link>
      <div className="mt-4 mb-1">
        <AgentBadge agent={agent} size="lg" showTagline />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Image Ads · upload a photo, get a finished ad with headline, subheadline, and CTA
        overlaid · {AD_IMAGE_CREDIT_COST} credits per generation
      </p>

      <AdImageClient
        key={generationId ?? "new"}
        projectId={id}
        initial={initial}
        initialPastGenerations={pastGenerations}
      />
    </div>
  );
}
