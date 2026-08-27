import type { GeneratorAssetType } from "@/lib/ai/generators";

// The default, plain-English order a first-time member should build a launch in — turning "here
// are 8 tools, good luck" into "follow this path." Deliberately covers only the core launch
// sequence (not every generator — PPT Outline and Offer Ladder are still reachable from the full
// tool grid below this on the project page) since a beginner needs one clear path, not a menu
// with everything weighted equally.
export type RoadmapStepId =
  | "offer"
  | "core_presentation"
  | "landing_page"
  | "thank_you_page"
  | "email_sequence"
  | "ads";

export interface RoadmapStep {
  id: RoadmapStepId;
  title: string;
  description: string;
  // Which generator asset types satisfy this step — any ONE of them being complete counts (e.g.
  // a Webinar Outline OR a VSL Script both satisfy "build your core presentation").
  assetTypes: GeneratorAssetType[];
  // The asset type the step's main "Start"/"View" button targets. Omitted only for the "offer"
  // step, which isn't a generator at all — it's the Discovery brief itself.
  primaryAssetType?: GeneratorAssetType;
  // A second, lower-emphasis path for steps with more than one acceptable asset type.
  altAssetType?: GeneratorAssetType;
  altLabel?: string;
}

export const ROADMAP_STEPS: RoadmapStep[] = [
  {
    id: "offer",
    title: "Define your offer",
    description: "Fill in your discovery brief — every asset below is built from this.",
    assetTypes: [],
  },
  {
    id: "core_presentation",
    title: "Build your Webinar or VSL",
    description: "The core presentation that teaches, builds belief, and makes the pitch.",
    assetTypes: ["webinar_outline", "vsl_script"],
    primaryAssetType: "webinar_outline",
    altAssetType: "vsl_script",
    altLabel: "or start with a VSL Script instead",
  },
  {
    id: "landing_page",
    title: "Create your Landing Page",
    description: "The page that gets someone to register or opt in — publish it live with one click when it's ready.",
    assetTypes: ["landing_page"],
    primaryAssetType: "landing_page",
  },
  {
    id: "thank_you_page",
    title: "Create your Thank You Page",
    description: "Confirms the action and sets up what happens next — generate one that automatically matches your Landing Page.",
    assetTypes: ["thank_you_page"],
    primaryAssetType: "thank_you_page",
  },
  {
    id: "email_sequence",
    title: "Write your Email Sequence",
    description: "Nurtures and reminds people all the way through to the event or offer.",
    assetTypes: ["email_sequence"],
    primaryAssetType: "email_sequence",
  },
  {
    id: "ads",
    title: "Create your Ad Copy",
    description: "Drives new traffic into the top of this funnel.",
    assetTypes: ["ad_copy"],
    primaryAssetType: "ad_copy",
  },
];
