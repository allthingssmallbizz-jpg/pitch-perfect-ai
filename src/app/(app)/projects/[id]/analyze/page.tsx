import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ANALYZER_CREDIT_COST } from "@/lib/ai/analyzer";
import { VIDEO_ANALYZER_CREDIT_COST } from "@/lib/ai/videoAnalyzer";
import { AGENTS } from "@/lib/agents/config";
import AgentBadge from "@/components/AgentBadge";
import AnalyzeClient from "./AnalyzeClient";

export default async function AnalyzePage({
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
    .select("id, name")
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
      <div className="mt-4 mb-1">
        <AgentBadge agent={AGENTS.presentation_analysis} size="lg" showTagline />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Conversion-readiness critique against a 19-point rubric · {ANALYZER_CREDIT_COST} credits to
        analyze pasted text, {VIDEO_ANALYZER_CREDIT_COST} credits for a full video upload (up to 90
        minutes) with delivery review
      </p>

      <AnalyzeClient
        projectId={id}
        initialContent={initialContent}
        initialGenerationId={initialGenerationId}
      />
    </div>
  );
}
