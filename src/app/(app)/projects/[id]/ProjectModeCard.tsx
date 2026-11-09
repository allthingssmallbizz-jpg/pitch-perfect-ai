import { FlaskConical, Radio } from "lucide-react";
import { setProjectDemoMode } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";

// Demo mode vs. Live mode (see 0052_demo_mode.sql). Demo = example data used to show what a
// finished presentation looks like: nothing blocks, every output is labeled Demo. Live = the real
// thing: real proof only, and critical Strategy Review issues must be resolved before approval.
export default function ProjectModeCard({
  projectId,
  isDemo,
  returnTo,
}: {
  projectId: string;
  isDemo: boolean;
  returnTo?: string;
}) {
  return (
    <div
      className={`mb-6 rounded-2xl border p-4 ${
        isDemo ? "border-red-500/40 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`flex items-center gap-2 font-semibold ${isDemo ? "text-red-400" : "text-emerald-400"}`}>
            {isDemo ? <FlaskConical className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
            {isDemo ? "Demo mode" : "Live mode"}
          </p>
          {isDemo ? (
            <p className="mt-1 text-sm text-red-100/90">
              This project uses <span className="font-semibold">example data</span> to show what&apos;s possible —
              build and share the full presentation to demonstrate the framework. Nothing is blocked, and everything
              you generate is labeled <span className="font-semibold">Demo</span>. Items marked{" "}
              <span className="font-bold text-red-400">*DEMO</span> in Discovery (proof, results, reviews, bonuses,
              values, deadlines) are examples only and can&apos;t be used in a live webinar.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              For real presentations to real prospects. Every claim must be true and provable, and critical Strategy
              Review issues must be fixed before your strategy can be approved.
            </p>
          )}
        </div>
        <form action={setProjectDemoMode}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="demo" value={isDemo ? "false" : "true"} />
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <Button type="submit" size="sm" variant={isDemo ? "default" : "outline"}>
            {isDemo ? "Switch to Live mode" : "Switch to Demo mode"}
          </Button>
        </form>
      </div>
      {isDemo && (
        <p className="mt-3 text-xs text-red-200/80">
          Going live? Switch to Live mode, replace every example with your real details (or your client&apos;s), then
          run the Strategy Review. Any strategy approved in Demo mode is retired when you go live.
        </p>
      )}
    </div>
  );
}
