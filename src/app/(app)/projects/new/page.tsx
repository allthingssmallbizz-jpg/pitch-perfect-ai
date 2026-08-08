import NewProjectForm from "./NewProjectForm";
import { AGENTS, type AgentAssetType } from "@/lib/agents/config";
import AgentBadge from "@/components/AgentBadge";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const agent = type && type in AGENTS ? AGENTS[type as AgentAssetType] : null;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      {agent ? (
        <div className="mb-6">
          <AgentBadge agent={agent} size="lg" showTagline />
          <p className="mt-3 text-sm text-muted-foreground">
            Name a project to get started — you&apos;ll fill in the discovery brief next.
          </p>
        </div>
      ) : (
        <h1 className="mb-6 font-display text-2xl font-semibold text-gradient-silver">Name your project</h1>
      )}
      <NewProjectForm type={type ?? null} />
    </div>
  );
}
