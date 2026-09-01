"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Plus,
  Sparkles,
  Mic,
  CreditCard,
  ShieldCheck,
  LogOut,
  BookOpen,
  Settings,
  GitCompareArrows,
  UserCircle,
  Globe,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { AGENTS, type AgentAssetType } from "@/lib/agents/config";
import { Badge } from "@/components/ui/badge";
import StartHereBadge from "@/components/StartHereBadge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

// Listed directly (rather than imported from src/lib/ai/generators, the registry that also
// carries the actual prompt-builder functions) so this client component doesn't pull the
// Node-only knowledge-file loader (src/lib/ai/systemPrompt.ts, used by the VSL generator) into
// the browser bundle — that reads from disk via `fs` and can't be chunked for the client.
//
// A member logging in with 10+ agents and no indication where to start asked "what do I do,
// where do I start?" — Bio and Discovery (see the "Start Here" badge above and the hard
// projectNeedsDiscovery gate in /api/generate/route.ts) already answer that for the very first
// two steps, neither of which is a generator agent. These two lists are the numbered answer for
// everything after: the one path every brand-new member should walk in order, split from the
// agents that are genuinely useful but fine to use "randomly whenever" (Aaron's words) — VSL,
// Challenge, Webinar Script, Ad Copy, Offer Ladder never block or gate on each other.
const CORE_PATH_ASSET_TYPES = [
  "webinar_outline",
  "ppt_outline",
  "landing_page",
  "sales_page",
  "thank_you_page",
  "email_sequence",
] as const satisfies Exclude<AgentAssetType, "presentation_analysis">[];

// Numbers pick up at 2 since Bio and Discovery are steps 0/1 and aren't generator agents. Webinar
// Blueprint and Your Signature Webinar share "2" on purpose — they're the same phase (fill out
// the blueprint, then the page's own "Generate Your Signature Webinar Now" button chains straight
// into the deck), not two separate steps to hunt for in the sidebar. Landing Page/Sales
// Letter/Thank You Page share "3" the same way — whichever a member's funnel actually needs.
const CORE_PATH_STEP: Record<(typeof CORE_PATH_ASSET_TYPES)[number], number> = {
  webinar_outline: 2,
  ppt_outline: 2,
  landing_page: 3,
  sales_page: 3,
  thank_you_page: 3,
  email_sequence: 4,
};

const OTHER_ASSET_TYPES: Exclude<AgentAssetType, "presentation_analysis">[] = [
  "vsl_script",
  "challenge_outline",
  "webinar_script",
  "ad_copy",
  "offer_ladder",
];

type CreateAssetType = (typeof CORE_PATH_ASSET_TYPES)[number] | (typeof OTHER_ASSET_TYPES)[number];

// Short label per generator for the sidebar's "Create" group — matches the Lovable prototype's
// nav wording (VSL, Sales Letter...) rather than the longer descriptions used elsewhere. Webinar
// Blueprint/Your Signature Webinar/Webinar Script are deliberately the same wording as
// ASSET_GENERATORS[type].label here — the three-step relationship between them (Sarah's blueprint
// feeds Polly's finished deck, which the script aligns to) is worth keeping identical everywhere
// a member sees it, not shortened differently in different places.
const CREATE_LABELS: Record<CreateAssetType, string> = {
  webinar_outline: "Webinar Blueprint",
  vsl_script: "VSL",
  challenge_outline: "Challenge",
  sales_page: "Sales Letter",
  ppt_outline: "Your Signature Webinar",
  webinar_script: "Webinar Script",
  landing_page: "Landing Page",
  thank_you_page: "Thank You Page",
  email_sequence: "Emails",
  ad_copy: "Ad Copy",
  offer_ladder: "Offer Ladder",
};

type Props = {
  email: string;
  // The account's saved display name (profiles.full_name), if they've set one via /settings.
  displayName: string | null;
  isAdmin: boolean;
  credits: number | null;
  // Drives the pulsating "Start Here" badge below — true until the bio has anything filled in.
  bioIncomplete: boolean;
};

export default function AppSidebar({ email, displayName, isAdmin, credits, bioIncomplete }: Props) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolvedName = displayName?.trim() || email.split("@")[0] || "You";
  // An agent is "active" either on its own landing page (/agents/[type], where past
  // generations across every project live — see the comment on that page) or mid-creation of
  // a brand-new project for it (/projects/new?type=...), which the landing page's "Start a new
  // project" card also routes through.
  const activeCreateType = pathname === "/projects/new" ? searchParams.get("type") : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-2">
          {!collapsed && (
            <span className="font-display text-sm font-semibold text-gradient-silver truncate">
              Pitch Perfect AI
            </span>
          )}
        </Link>
        {!collapsed && (
          <div className="flex items-center gap-1.5 truncate px-2 pb-1">
            <span className="truncate text-xs text-muted-foreground">Hi, {resolvedName}</span>
            <Badge variant={isAdmin ? "default" : "secondary"} className="h-4 shrink-0 px-1.5 text-[9px] uppercase tracking-wide">
              {isAdmin ? "Admin" : "Member"}
            </Badge>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/dashboard"} tooltip="Dashboard">
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {/* First stop for a new member, before anything else — the bio (including the "I
                  Help" statement) feeds every generator's system prompt, so filling it in before
                  creating anything means the very first generation already has it available. The
                  pulsating badge (also spotlighted by the dashboard's first onboarding-tour step,
                  data-tour="sidebar-bio") is the direct answer to "where do I start?" — it only
                  shows while the bio is still empty and disappears the moment it's filled in. */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/bio"} tooltip="My Webinar Bio — start here">
                  <Link href="/bio" data-tour="sidebar-bio">
                    <UserCircle className="h-4 w-4" />
                    <span className="flex items-center gap-1.5 truncate">
                      My Webinar Bio
                      {bioIncomplete && !collapsed && <StartHereBadge />}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/projects/new"} tooltip="New project">
                  <Link href="/projects/new" data-tour="sidebar-new-project">
                    <Plus className="h-4 w-4" />
                    <span>New project</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup data-tour="sidebar-create">
          <SidebarGroupLabel>Create</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {CORE_PATH_ASSET_TYPES.map((type) => {
                const agent = AGENTS[type];
                const step = CORE_PATH_STEP[type];
                return (
                  <SidebarMenuItem key={type}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/agents/${type}` || activeCreateType === type}
                      tooltip={`Step ${step} — ${agent.name} · ${CREATE_LABELS[type]}`}
                    >
                      <Link href={`/agents/${type}`}>
                        {!collapsed && (
                          <span
                            aria-hidden
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                          >
                            {step}
                          </span>
                        )}
                        <span aria-hidden>{agent.emoji}</span>
                        <span className="truncate">
                          {agent.name} <span className="text-muted-foreground">· {CREATE_LABELS[type]}</span>
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {!collapsed && (
                <SidebarMenuItem>
                  <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Other agents · use anytime
                  </div>
                </SidebarMenuItem>
              )}

              {OTHER_ASSET_TYPES.map((type) => {
                const agent = AGENTS[type];
                return (
                  <SidebarMenuItem key={type}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/agents/${type}` || activeCreateType === type}
                      tooltip={`${agent.name} — ${CREATE_LABELS[type]}`}
                    >
                      <Link href={`/agents/${type}`}>
                        <span aria-hidden>{agent.emoji}</span>
                        <span className="truncate">
                          {agent.name} <span className="text-muted-foreground">· {CREATE_LABELS[type]}</span>
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/headline-lab"} tooltip="Headline lab">
                  <Link href="/headline-lab">
                    <Sparkles className="h-4 w-4" />
                    <span>Headline lab</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/analyze" || activeCreateType === "presentation_analysis"}
                  tooltip="Agent Annie — Analyzer"
                >
                  <Link href="/analyze" data-tour="sidebar-analyzer">
                    <span aria-hidden>{AGENTS.presentation_analysis.emoji}</span>
                    <span className="truncate">
                      {AGENTS.presentation_analysis.name} <span className="text-muted-foreground">· Analyzer</span>
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/social-compare"} tooltip="Social Detective (Beta)">
                  <Link href="/social-compare">
                    <GitCompareArrows className="h-4 w-4" />
                    <span className="flex items-center gap-1.5 truncate">
                      Social Detective
                      <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[9px] uppercase tracking-wide">
                        Beta
                      </Badge>
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/websites"} tooltip="My Websites">
                  <Link href="/websites">
                    <Globe className="h-4 w-4" />
                    <span>My Websites</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/templates"} tooltip="Templates">
                  <Link href="/templates" data-tour="sidebar-templates">
                    <BookOpen className="h-4 w-4" />
                    <span>Templates</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/brand-voice"} tooltip="Brand voice">
                  <Link href="/brand-voice">
                    <Mic className="h-4 w-4" />
                    <span>Brand voice</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/billing"} tooltip="Billing">
                  <Link href="/billing" data-tour="sidebar-billing">
                    <CreditCard className="h-4 w-4" />
                    <span>
                      Billing{isAdmin ? " · Unlimited" : credits !== null ? ` · ${credits} credits` : ""}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/admin"} tooltip="Admin">
                    <Link href="/admin">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/settings"} tooltip="Settings">
                  <Link href="/settings">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <form action={signOut}>
                  <SidebarMenuButton type="submit" tooltip="Sign out">
                    <LogOut className="h-4 w-4" />
                    <span>Sign out</span>
                  </SidebarMenuButton>
                </form>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 shrink-0 rounded-full border border-primary/30 bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
            {resolvedName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">{resolvedName}</span>
                <Badge variant={isAdmin ? "default" : "secondary"} className="h-4 shrink-0 px-1.5 text-[9px] uppercase tracking-wide">
                  {isAdmin ? "Admin" : "Member"}
                </Badge>
              </div>
              <div className="truncate text-xs text-muted-foreground">{email}</div>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
