import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ASSET_GENERATORS, ASSET_TYPES } from "@/lib/ai/generators";
import { getAssetLabel, getAssetHref } from "@/lib/ai/assetLabels";
import { ANALYZER_CREDIT_COST } from "@/lib/ai/analyzer";
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">
        ← All projects
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">{project.name}</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Discovery
          </h2>
          <DiscoveryForm project={project} />
        </div>

        <div className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Generate an asset
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ASSET_TYPES.map((type) => {
              const gen = ASSET_GENERATORS[type];
              return (
                <Link
                  key={type}
                  href={`/projects/${project.id}/generate/${type}`}
                  className="rounded-lg border border-neutral-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{gen.label}</h3>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                      {gen.creditCost} credits
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">{gen.description}</p>
                </Link>
              );
            })}
          </div>

          <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Analyze a presentation
          </h2>
          <Link
            href={`/projects/${project.id}/analyze`}
            className="block rounded-lg border border-neutral-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Presentation Analyzer</h3>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                {ANALYZER_CREDIT_COST} credits
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              Paste a webinar, VSL, sales presentation, or investor pitch script and get a
              19-point conversion-readiness critique with scores, missing components, and a
              prioritized fix list.
            </p>
          </Link>

          <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            History
          </h2>
          {!generations || generations.length === 0 ? (
            <p className="text-sm text-neutral-500">No generations yet.</p>
          ) : (
            <ul className="space-y-2">
              {generations.map((g) => (
                <li key={g.id}>
                  <Link
                    href={getAssetHref(project.id, g.asset_type, g.id)}
                    className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm hover:border-indigo-300"
                  >
                    <span>
                      {getAssetLabel(g.asset_type)}{" "}
                      <span className="text-neutral-400">· {g.mode}</span>
                    </span>
                    <span
                      className={
                        g.status === "complete"
                          ? "text-green-600"
                          : g.status === "failed"
                            ? "text-red-600"
                            : "text-neutral-400"
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
