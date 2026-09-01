"use client";

import { useState } from "react";
import OnboardingTour, { type TourStep } from "@/components/OnboardingTour";
import SampleProjectDialog from "@/components/SampleProjectDialog";
import { onboardingKeys, useLocalFlag } from "@/hooks/useLocalFlag";

const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="sidebar-bio"]',
    title: "Start here",
    body: "Fill in your bio first — it's used across every webinar, VSL, and page you generate, so this is always step one.",
    placement: "right",
  },
  {
    target: '[data-tour="sidebar-new-project"]',
    title: "Then start a new project",
    body: "Every asset starts with a project — your offer's full discovery brief (audience, positioning, offer, and more) has to be filled in before any agent will generate.",
    placement: "right",
  },
  {
    target: '[data-tour="sidebar-create"]',
    title: "Your AI marketing team",
    body: "Pick an agent to generate a webinar, VSL, sales page, and more — each one specialized for that asset type.",
    placement: "right",
  },
  {
    target: '[data-tour="sidebar-analyzer"]',
    title: "Get a critique",
    body: "Agent Annie scores any webinar, VSL, or presentation against a 19-point rubric — paste text or upload a full video.",
    placement: "right",
  },
  {
    target: '[data-tour="sidebar-templates"]',
    title: "Swipe file",
    body: "Six pre-filled example briefs — clone one and generate in seconds instead of starting blank.",
    placement: "right",
  },
  {
    target: '[data-tour="sidebar-billing"]',
    title: "Credits & billing",
    body: "Every generation is metered — track your balance and manage your plan here.",
    placement: "right",
  },
];

// Mounted once on the dashboard. Two independent first-visit nudges, both gated by their own
// localStorage flag (src/hooks/useLocalFlag.ts) so returning users never see either again.
export default function DashboardOnboarding({ hasProjects }: { hasProjects: boolean }) {
  const [sampleOffered] = useLocalFlag(onboardingKeys.sampleOffered);
  const [sampleDialogOpen, setSampleDialogOpen] = useState(!hasProjects && !sampleOffered);

  return (
    <>
      <OnboardingTour tourKey="dashboard" steps={DASHBOARD_TOUR_STEPS} />
      {!hasProjects && (
        <SampleProjectDialog open={sampleDialogOpen} onOpenChange={setSampleDialogOpen} />
      )}
    </>
  );
}
