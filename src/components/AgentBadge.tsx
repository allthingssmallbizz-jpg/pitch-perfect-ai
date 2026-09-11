import type { Agent } from "@/lib/agents/config";
import { getAgentAvatarDataUri } from "@/lib/agents/avatar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Single reusable presentation of an agent's identity — used on the project page's
// generator grid, each generate/analyze page header, and the landing page's team teaser.
// Keeps the "who is this" branding consistent in one place instead of hand-rolling the
// avatar/name/title markup on every page that shows an agent.
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
  const avatarSize = size === "lg" ? "h-14 w-14" : size === "md" ? "h-11 w-11" : "h-8 w-8";
  const nameSize = size === "lg" ? "text-xl" : size === "md" ? "text-base" : "text-sm";

  return (
    <div className={cn("flex items-start gap-3", className)}>
      {/* A generated robot-mascot face (see getAgentAvatarDataUri) rather than the agent's
          own emoji — a clapperboard or a microphone icon says what the agent DOES, not who
          it IS, and Aaron wanted every agent to actually have a face. Computed inline (an SVG
          data URI, no network request) so it renders identically on first paint with no
          loading flash; AvatarFallback still covers the split-second before hydration/the
          rare case the data URI fails to decode. */}
      {/* rounded-xl, not the Avatar default rounded-full — bottts' robots each fill their own
          square tile, with antennae and side details that sometimes cross the square's edge;
          a circular crop would slice into those, where a soft-rounded square doesn't. */}
      <Avatar className={cn(avatarSize, "shrink-0 rounded-xl border border-primary/20 bg-primary/10")}>
        <AvatarImage src={getAgentAvatarDataUri(agent)} alt={agent.name} />
        <AvatarFallback aria-hidden>{agent.emoji}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className={cn("font-display font-semibold text-gradient-silver", nameSize)}>{agent.name}</div>
        <div className="text-xs uppercase tracking-wide text-primary">{agent.title}</div>
        {showTagline && <p className="mt-1 text-sm text-muted-foreground">{agent.tagline}</p>}
      </div>
    </div>
  );
}

