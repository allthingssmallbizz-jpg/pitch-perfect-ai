import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AGENTS } from "@/lib/agents/config";
import { projectNeedsDiscovery } from "@/lib/projects";
import { SOCIAL_COMPARE_CREDIT_COST } from "@/lib/ai/socialCompare";
import AgentBadge from "@/components/AgentBadge";
import SocialCompareClient from "./SocialCompareClient";

export default async function SocialComparePage({
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
    .is("deleted_at", null)
    .single();
  if (!project) notFound();

  // Only guard a fresh visit — opening a specific past comparison (?generationId=) shows real
  // content regardless of the project's current discovery state, same as every generate page.
  if (!generationId && projectNeedsDiscovery(project)) {
    redirect(`/projects/${id}?intent=social_compare`);
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

  const { data: pastGenerationRows } = await supabase
    .from("generations")
    .select("id, content, status, created_at")
    .eq("project_id", id)
    .eq("asset_type", "social_compare")
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(30);

  const pastGenerations = (pastGenerationRows ?? []).map((g) => ({
    id: g.id,
    createdAt: g.created_at,
    preview: (g.content ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
  }));

  const agent = AGENTS.presentation_analysis;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href={`/projects/${id}`} className="text-sm text-primary hover:underline">
        ← {project.name}
      </Link>
      <div className="mt-4 mb-1">
        <AgentBadge agent={agent} size="lg" showTagline />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Social Media Comparison · compare your TikTok/Instagram/Facebook page against a
        high-performing one · {SOCIAL_COMPARE_CREDIT_COST} credits per comparison
      </p>

      <SocialCompareClient
        projectId={id}
        initialContent={initialContent}
        initialGenerationId={initialGenerationId}
        initialPastGenerations={pastGenerations}
      />
    </div>
  );
}
