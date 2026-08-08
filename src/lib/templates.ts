import type { GeneratorAssetType } from "@/lib/ai/generators";
import type { Project } from "@/types/database";

// Swipe-file templates for the /templates page — pre-filled example briefs so a new user can
// clone one, tweak the details, and generate immediately instead of starting from a blank
// discovery form. Ported from the Lovable prototype's TEMPLATES list, remapped onto this app's
// full discovery field set (src/types/database.ts).
export type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  assetType: GeneratorAssetType;
  answers: Partial<Project>;
};

export const TEMPLATES: Template[] = [
  {
    id: "coach-2k-program",
    name: "Coach launching a $2k program",
    category: "Coaching",
    description:
      "Life/business coach launching a mid-ticket 8-week group program. Great for webinars + email sequences.",
    assetType: "webinar_outline",
    answers: {
      business_name: "The Momentum Method",
      industry: "Life & business coaching",
      product: "The Momentum Method (8-week group coaching)",
      audience:
        "Ambitious professionals aged 30-45 stuck at a career plateau who feel exhausted and unfulfilled despite outward success.",
      core_promise: "Reclaim 10+ hours a week and double your income in 90 days without burning out.",
      desired_transformation:
        "From overworked and stuck to energized, in-demand, and earning more with less time.",
      unique_mechanism:
        "The 3-Layer Momentum System (Clarity, Cadence, Conversion) — a proprietary weekly cadence that compounds output without adding hours.",
      price: "$1,997",
      false_beliefs: "\"I've tried coaching before and it didn't stick.\"",
      proof:
        "42 clients over 3 years; average income lift of 38% in 90 days; 3 detailed case studies (Sarah, Marcus, Priya).",
      guarantee: "Full refund inside 14 days if you complete week 1 and don't feel more clarity.",
      category: "Online coaching",
    },
  },
  {
    id: "saas-free-trial",
    name: "SaaS free trial → paid",
    category: "SaaS",
    description: "B2B SaaS with a 14-day free trial. Landing page + email sequence to convert trialers.",
    assetType: "landing_page",
    answers: {
      business_name: "Loop",
      industry: "B2B SaaS — remote team collaboration",
      product: "Loop — async standups for remote teams",
      audience:
        "Engineering managers of 10-50 person distributed teams tired of Zoom fatigue and unclear priorities.",
      core_promise: "Kill your daily standup meeting without losing visibility.",
      desired_transformation:
        "From back-to-back meetings to focused deep work, with better team clarity than before.",
      unique_mechanism:
        "AI-summarized async video updates that surface blockers automatically — no reading, no meetings.",
      price: "$12/user/month, 14-day free trial (no card required)",
      false_beliefs: "\"My team won't actually use it.\"",
      proof: "3,400 teams onboarded; 89% still active at 30 days; case studies from Notion, Linear, and a YC batch.",
      guarantee: "Full 14-day trial with no card. Cancel any time inside the app.",
      category: "Team collaboration software",
    },
  },
  {
    id: "info-product-tripwire",
    name: "Info product with $27 tripwire",
    category: "Info product",
    description:
      "Digital course seller running Facebook ads to a low-ticket tripwire, then ascending to a $497 offer.",
    assetType: "vsl_script",
    answers: {
      business_name: "The 5-Minute Email Formula",
      industry: "Email marketing education",
      product: "The 5-Minute Email Formula",
      audience: "Solopreneurs and course creators with a list of 500-5,000 who send emails that get ignored.",
      core_promise: "Write emails your list actually opens, clicks, and buys from — in under 5 minutes each.",
      desired_transformation: "From dreading email marketing to loving it (and making money from every send).",
      unique_mechanism:
        "The Curiosity Loop Framework — a 3-line opener that spikes open rates and pulls readers into the click.",
      price: "$27 (with a $197 order bump and $497 upsell)",
      false_beliefs: "\"Another cheap product that won't work.\"",
      proof: "1,200+ buyers; average open rate lift from 18% to 41%; 12 real send-comparison screenshots.",
      guarantee:
        "30-day \"send 10 emails\" guarantee — if your open rate doesn't improve, refund + keep the product.",
      category: "Digital marketing courses",
    },
  },
  {
    id: "agency-lead-gen",
    name: "Agency lead-gen offer",
    category: "Agency",
    description: "Marketing/dev agency using a free audit as the entry point to a $5k-$15k retainer.",
    assetType: "sales_page",
    answers: {
      business_name: "Growth Audit",
      industry: "Ecommerce growth marketing agency",
      product: "Free Growth Audit (for ecom brands doing $1M+)",
      audience: "Founders of DTC ecom brands doing $1M-$10M/year whose paid growth has stalled.",
      core_promise:
        "Find $50k+ in missed revenue in your funnel in 30 minutes — with a video breakdown you can act on today.",
      desired_transformation:
        "From stalled growth and unclear where to invest ad spend, to a clear 90-day plan with prioritized levers.",
      unique_mechanism:
        "The 7-point Growth Diagnostic covers offer, funnel, retention, CAC, LTV, creative, and channel mix.",
      price: "Free audit → $8,500/mo retainer for a 6-month engagement.",
      false_beliefs: "\"Every agency pitches this and delivers nothing.\"",
      proof:
        "Averaged 2.3x ROAS lift across 40+ brands in 12 months. Named case studies from Ridge, Bearaby, and Olipop.",
      guarantee: "First 30 days performance-based. Miss the KPI, you don't pay.",
      category: "Ecommerce growth agency",
    },
  },
  {
    id: "high-ticket-mastermind",
    name: "High-ticket mastermind ($15k+)",
    category: "Coaching",
    description: "Application-based mastermind for advanced clients. Best for webinars → application call funnels.",
    assetType: "webinar_outline",
    answers: {
      business_name: "The Inner Circle Mastermind",
      industry: "High-ticket business coaching",
      product: "The Inner Circle Mastermind (12-month)",
      audience:
        "Founders and 7-figure operators who have hit a ceiling and need peers + strategic guidance, not tactics.",
      core_promise: "Add $1M+ in the next 12 months without adding a single hour to your calendar.",
      desired_transformation:
        "From lonely at the top and reactive, to surrounded by peers, focused on the 3 moves that matter.",
      unique_mechanism:
        "Quarterly in-person intensives + weekly 90-minute hot-seat calls + private direct access.",
      price: "$25,000/year (application required)",
      false_beliefs: "\"I don't have time for another program.\"",
      proof:
        "34 members; average member added $2.1M in year 1; 3 have exited for 8 figures. Video testimonials on file.",
      guarantee: "First 60 days: full refund if the intensives don't meet the promise. No questions.",
      category: "Executive mastermind",
    },
  },
  {
    id: "physical-product-launch",
    name: "Physical product launch",
    category: "Ecommerce",
    description: "DTC brand launching a new product to an existing list. Landing page + launch email sequence.",
    assetType: "email_sequence",
    answers: {
      business_name: "Nightshift",
      industry: "Sleep & wellness products",
      product: "The Nightshift Pillow",
      audience: "Adults 30-55 who struggle to fall asleep because of racing thoughts, night sweats, or neck pain.",
      core_promise:
        "Fall asleep 3x faster and wake up without neck pain — clinically-tested cooling memory foam.",
      desired_transformation: "From tossing for 45 minutes every night to falling asleep in under 10.",
      unique_mechanism:
        "Dual-layer graphene cooling core + contoured cervical support, developed with a sleep neurologist.",
      price: "$149 (launch price $119 for the first 500 customers)",
      false_beliefs: "\"I've bought expensive pillows before and they didn't help.\"",
      proof:
        "6-month clinical study with 128 participants: 78% reported faster sleep onset. Founder story featured on national TV.",
      guarantee: "100-night trial, free returns, no questions.",
      category: "DTC sleep products",
    },
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
