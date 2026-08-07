import type { Agent } from "@/lib/agents/config";
import { cn } from "@/lib/utils";

// Single reusable presentation of an agent's identity — used on the project page's
// generator grid, each generate/analyze page header, and the landing page's team teaser.
// Keeps the "who is this" branding consistent in one place instead of hand-rolling the
// emoji/name/title markup on every page that shows an agent.
export default function AgentBadge({
  agent,
  size = "md",
  showTagline = false,
  className,
}: {
  agent: Agent;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
}) {
  const emojiSize = size === "lg" ? "text-3xl" : size === "md" ? "text-2xl" : "text-lg";
  const nameSize = size === "lg" ? "text-xl" : size === "md" ? "text-base" : "text-sm";

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className={emojiSize} aria-hidden>
        {agent.emoji}
      </span>
      <div className="min-w-0">
        <div className={cn("font-display font-semibold text-gradient-silver", nameSize)}>{agent.name}</div>
        <div className="text-xs uppercase tracking-wide text-primary">{agent.title}</div>
        {showTagline && <p className="mt-1 text-sm text-muted-foreground">{agent.tagline}</p>}
      </div>
    </div>
  );
}
