import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ANALYZER_CREDIT_COST } from "@/lib/ai/analyzer";
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
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href={`/projects/${id}`} className="text-sm text-indigo-600 hover:underline">
        ← {project.name}
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-semibold">Presentation Analyzer</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Conversion-readiness critique against a 19-point rubric · {ANALYZER_CREDIT_COST} credits per
        analysis
      </p>

      <AnalyzeClient
        projectId={id}
        initialContent={initialContent}
        initialGenerationId={initialGenerationId}
      />
    </div>
  );
}
