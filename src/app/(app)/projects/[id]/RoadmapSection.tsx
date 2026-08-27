import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { ROADMAP_STEPS } from "@/lib/roadmap";
import { AGENTS } from "@/lib/agents/config";
import { ASSET_GENERATORS } from "@/lib/ai/generators";
import { Button } from "@/components/ui/button";
import type { AssetType } from "@/types/database";

type CompleteGeneration = { id: string; asset_type: AssetType; created_at: string };

// The single biggest gap for a member who's never built a launch before: a flat grid of 8 equal-
// weight tool cards gives no sense of order or "what do I actually do first." This turns that
// into an ordered checklist — one clear next step at a time, with a direct link into exactly the
// right generator, and a "View" link straight to the finished asset once a step is done.
export default function RoadmapSection({
  projectId,
  completeGenerations,
  discoveryComplete,
}: {
  projectId: string;
  completeGenerations: CompleteGeneration[];
  discoveryComplete: boolean;
}) {
  function findLatest(assetTypes: AssetType[]): CompleteGeneration | null {
    return completeGenerations.find((g) => assetTypes.includes(g.asset_type)) ?? null;
  }

  const stepStates = ROADMAP_STEPS.map((step) => {
    if (step.id === "offer") {
      return { step, complete: discoveryComplete, latest: null as CompleteGeneration | null };
    }
    const latest = findLatest(step.assetTypes);
    return { step, complete: Boolean(latest), latest };
  });

  const currentIndex = stepStates.findIndex((s) => !s.complete);
  const doneCount = stepStates.filter((s) => s.complete).length;

  return (
    <div className="card-elevated mb-8 rounded-2xl p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Your launch roadmap</h2>
        <span className="shrink-0 text-xs text-muted-foreground">
          {doneCount} of {stepStates.length} done
        </span>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Follow these steps in order and you&apos;ll have a complete campaign — no guessing what to
        build next. Every tool is still available in the full list below if you&apos;d rather jump
        around.
      </p>
      <ol>
        {stepStates.map(({ step, complete, latest }, i) => {
          const isCurrent = i === currentIndex;
          const isLast = i === stepStates.length - 1;
          const assetType = step.primaryAssetType;
          const agent = assetType ? AGENTS[assetType] : null;
          const generator = assetType ? ASSET_GENERATORS[assetType] : null;

          let href: string;
          let ctaLabel: string;
          if (step.id === "offer") {
            href = "#discovery-form";
            ctaLabel = complete ? "Review" : "Fill in discovery";
          } else if (complete && latest) {
            href = `/projects/${projectId}/generate/${latest.asset_type}?generationId=${latest.id}`;
            ctaLabel = "View";
          } else if (!discoveryComplete) {
            href = `/projects/${projectId}?intent=${assetType}`;
            ctaLabel = "Start";
          } else {
            href = `/projects/${projectId}/generate/${assetType}`;
            ctaLabel = "Start";
          }

          return (
            <li key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
              {!isLast && (
                <span
                  aria-hidden
                  className={`absolute top-8 left-[15px] h-[calc(100%-1.5rem)] w-px ${
                    complete ? "bg-emerald-500/40" : "bg-border"
                  }`}
                />
              )}
              <div className="relative z-10 shrink-0">
                {complete ? (
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                ) : (
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${
                      isCurrent ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {agent && <span aria-hidden>{agent.emoji}</span>}
                    <span className="font-medium">{step.title}</span>
                    {isCurrent && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Up next
                      </span>
                    )}
                  </div>
                  <Button variant={complete ? "outline" : "default"} size="sm" asChild>
                    <Link href={href}>
                      {ctaLabel}
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.description}
                  {generator && <span className="ml-1 whitespace-nowrap text-xs">· {generator.creditCost} credits</span>}
                </p>
                {step.altAssetType && step.altLabel && !complete && (
                  <Link
                    href={
                      discoveryComplete
                        ? `/projects/${projectId}/generate/${step.altAssetType}`
                        : `/projects/${projectId}?intent=${step.altAssetType}`
                    }
                    className="mt-1 inline-block text-xs text-primary hover:underline"
                  >
                    {step.altLabel}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
