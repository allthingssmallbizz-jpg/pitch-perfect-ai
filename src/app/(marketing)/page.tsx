import Link from "next/link";
import { AGENTS, type AgentAssetType } from "@/lib/agents/config";
import AgentBadge from "@/components/AgentBadge";

const AGENT_ORDER: AgentAssetType[] = [
  "webinar_outline",
  "vsl_script",
  "challenge_outline",
  "sales_page",
  "landing_page",
  "email_sequence",
  "ppt_outline",
  "ad_copy",
  "offer_ladder",
  "presentation_analysis",
];

export default function Home() {
  return (
    <div>
      <section className="mx-auto max-w-4xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight text-gradient-silver sm:text-5xl">
          Turn your offer into a webinar, VSL, and launch sequence — in minutes.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Pitch Perfect AI runs the exact Discovery → Positioning → Presentation system behind
          every high-converting webinar and sales asset, wrapped in an app built for your
          12-month program access.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-border px-5 py-3 font-medium hover:bg-secondary"
          >
            Log in
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24">
        <h2 className="mb-2 text-center font-display text-2xl font-semibold text-gradient-silver">
          Meet your AI marketing team
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-muted-foreground">
          Every asset runs on the same Pitch Perfect Method™ brain — each specialist just
          brings a different focus to it.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGENT_ORDER.map((type) => (
            <div key={type} className="card-elevated rounded-xl p-5">
              <AgentBadge agent={AGENTS[type]} showTagline />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
