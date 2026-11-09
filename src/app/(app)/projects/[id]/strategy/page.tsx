import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { projectNeedsDiscovery } from "@/lib/projects";
import { loadStrategyState } from "@/lib/strategy/server";
import StrategyClient from "./StrategyClient";
import ProjectModeCard from "../ProjectModeCard";

export const metadata = { title: "Strategy Review" };

// Discovery → AI Strategy Review → Approval → Generate. Discovery itself is never modified here:
// reviews, recommendations, and approved blueprints all live in their own versioned tables.
export default async function StrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const state = await loadStrategyState(createAdminClient(), project);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {project.name}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Strategy Review</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Before we build your presentation, we review your strategy, strengthen your positioning, and make sure your
        offer is clear and believable. Nothing here changes your Discovery answers — you approve every change.
      </p>
      <div className="mt-4">
        <ProjectModeCard projectId={id} isDemo={Boolean(project.is_demo)} returnTo={`/projects/${id}/strategy`} />
      </div>
      <StrategyClient
        projectId={id}
        initialState={state}
        discoveryIncomplete={projectNeedsDiscovery(project)}
        isDemo={Boolean(project.is_demo)}
      />
    </div>
  );
}
