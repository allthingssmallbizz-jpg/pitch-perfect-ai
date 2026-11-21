import Link from "next/link";
import { ArrowDown, ArrowRight, MonitorPlay, Zap } from "lucide-react";
import { EXPRESS_FORMATS } from "@/lib/express";

// "What kind of presentation are you creating today?" — the Signature Webinar (the roadmap below)
// or Pitch Perfect Express™, the short-form builder for meetings and speaking slots. Express skips
// the full webinar Discovery brief: it asks a few questions about the specific room instead.
export default function PresentationTypeChooser({ projectId }: { projectId: string }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        What kind of presentation are you creating today?
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href="#roadmap"
          className="card-elevated flex items-start gap-3 rounded-2xl p-4 transition-colors hover:border-primary/50"
        >
          <MonitorPlay className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block font-display font-semibold">Signature Webinar</span>
            <span className="block text-sm text-muted-foreground">
              Long-form (60–90 slides) for educating, positioning, and selling your offer. Follow the roadmap below.
            </span>
          </span>
          <ArrowDown className="mt-1 h-4 w-4 shrink-0 text-primary" />
        </a>
        <Link
          href={`/projects/${projectId}/generate/express_deck`}
          className="card-elevated flex items-start gap-3 rounded-2xl border-primary/40 p-4 transition-colors hover:border-primary"
        >
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block font-display font-semibold">Pitch Perfect Express™</span>
            <span className="block text-sm text-muted-foreground">
              Short-form ({EXPRESS_FORMATS.quick.slides}–{EXPRESS_FORMATS.authority.slides} slides) for meetings, speaking
              slots, group leaders, and decision-makers — with your script, close, and follow-up.
            </span>
          </span>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary" />
        </Link>
      </div>
    </section>
  );
}
