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
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { AGENTS, type AgentAssetType } from "@/lib/agents/config";
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
const CREATE_ASSET_TYPES: Exclude<AgentAssetType, "presentation_analysis">[] = [
  "webinar_outline",
  "vsl_script",
  "sales_page",
  "ppt_outline",
  "landing_page",
  "email_sequence",
  "ad_copy",
  "offer_ladder",
];

// Short label per generator for the sidebar's "Create" group — matches the Lovable prototype's
// nav wording (Webinar, VSL, Sales Letter, Presentation...) rather than the longer labels used
// elsewhere (ASSET_GENERATORS[type].label, e.g. "Webinar Outline").
const CREATE_LABELS: Record<(typeof CREATE_ASSET_TYPES)[number], string> = {
  webinar_outline: "Webinar",
  vsl_script: "VSL",
  sales_page: "Sales Letter",
  ppt_outline: "Presentation",
  landing_page: "Landing Page",
  email_sequence: "Emails",
  ad_copy: "Ad Copy",
  offer_ladder: "Offer Ladder",
};

type Props = {
  email: string;
  isAdmin: boolean;
  credits: number | null;
};

export default function AppSidebar({ email, isAdmin, credits }: Props) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const displayName = email.split("@")[0] || "You";
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
              {CREATE_ASSET_TYPES.map((type) => {
                const agent = AGENTS[type];
                return (
                  <SidebarMenuItem key={type}>
                    <SidebarMenuButton
                      asChild
                      isActive={activeCreateType === type}
                      tooltip={`${agent.name} — ${CREATE_LABELS[type]}`}
                    >
                      <Link href={`/projects/new?type=${type}`}>
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
            {displayName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{displayName}</div>
              <div className="truncate text-xs text-muted-foreground">{email}</div>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
