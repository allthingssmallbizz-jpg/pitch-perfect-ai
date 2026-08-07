import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ASSET_GENERATORS, ASSET_TYPES } from "@/lib/ai/generators";
import { getAssetLabel, getAssetHref } from "@/lib/ai/assetLabels";
import { ANALYZER_CREDIT_COST } from "@/lib/ai/analyzer";
import { Badge } from "@/components/ui/badge";
import { Gauge } from "lucide-react";
import DiscoveryForm from "./DiscoveryForm";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
    .single();

  if (!project) notFound();

  const { data: generations } = await supabase
    .from("generations")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/dashboard" className="text-sm text-primary hover:underline">
        ← All projects
      </Link>
      <h1 className="mt-2 mb-6 font-display text-2xl font-semibold text-gradient-silver">{project.name}</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Discovery
          </h2>
          <DiscoveryForm project={project} />
        </div>

        <div className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Generate an asset
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ASSET_TYPES.map((type) => {
              const gen = ASSET_GENERATORS[type];
              return (
                <Link
                  key={type}
                  href={`/projects/${project.id}/generate/${type}`}
                  className="card-elevated rounded-xl p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{gen.label}</h3>
                    <Badge variant="secondary">{gen.creditCost} credits</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{gen.description}</p>
                </Link>
              );
            })}
          </div>

          <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Analyze a presentation
          </h2>
          <Link
            href={`/projects/${project.id}/analyze`}
            className="card-elevated block rounded-xl p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-medium">
                <Gauge className="h-4 w-4 text-primary" />
                Presentation Analyzer
              </h3>
              <Badge variant="secondary">{ANALYZER_CREDIT_COST} credits</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste a webinar, VSL, sales presentation, or investor pitch script and get a
              19-point conversion-readiness critique with scores, missing components, and a
              prioritized fix list.
            </p>
          </Link>

          <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            History
          </h2>
          {!generations || generations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No generations yet.</p>
          ) : (
            <ul className="space-y-2">
              {generations.map((g) => (
                <li key={g.id}>
                  <Link
                    href={getAssetHref(project.id, g.asset_type, g.id)}
                    className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-4 py-2 text-sm transition-colors hover:border-primary/40"
                  >
                    <span>
                      {getAssetLabel(g.asset_type)}{" "}
                      <span className="text-muted-foreground">· {g.mode}</span>
                    </span>
                    <span
                      className={
                        g.status === "complete"
                          ? "text-emerald-400"
                          : g.status === "failed"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {g.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
