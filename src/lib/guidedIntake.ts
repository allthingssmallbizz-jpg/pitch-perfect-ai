// Plain-English, one-question-at-a-time rewrite of the 14-point discovery brief — the same
// underlying fields DiscoveryForm.tsx collects (and the same server action saves them to), just
// asked as a conversation instead of a jargon-heavy form with 25 boxes visible at once. This is
// the front door for someone who's never heard of "the enemy," "unique mechanism," or "awareness
// level" — GuidedIntake.tsx walks through these one at a time; DiscoveryForm.tsx stays available
// as the "I know what I'm doing, let me see everything at once" alternative.

export type GuidedQuestionType = "text" | "textarea" | "choice";

export interface GuidedChoice {
  value: string;
  label: string;
  hint: string;
}

export interface GuidedQuestion {
  key: string;
  section: string;
  question: string;
  helper?: string;
  type: GuidedQuestionType;
  placeholder?: string;
  required: boolean;
  choices?: GuidedChoice[];
}

// Mirrors REQUIRED_DISCOVERY_FIELDS (src/lib/projects.ts) plus the project name itself — walking
// through all of these is what makes a project ready to generate from.
export const GUIDED_REQUIRED_QUESTIONS: GuidedQuestion[] = [
  {
    key: "name",
    section: "Let's get started",
    question: "What should we call this project?",
    helper: "Just an internal name so you can find it later — your audience never sees this.",
    type: "text",
    placeholder: "e.g. Spring Webinar Launch",
    required: true,
  },
  {
    key: "business_name",
    section: "About you",
    question: "What's the name of your business or brand?",
    helper: "How you want to be introduced — the name people will hear on the webinar.",
    type: "text",
    placeholder: "e.g. Coach Bowe's Pitch Perfect Method",
    required: true,
  },
  {
    key: "industry",
    section: "About you",
    question: "In a few words, what industry or niche are you in?",
    helper: 'Be specific — "weight loss coaching for women over 50" beats just "health."',
    type: "text",
    placeholder: "e.g. Fitness coaching for busy professionals",
    required: true,
  },
  {
    key: "product",
    section: "About you",
    question: "What do you actually sell?",
    helper: "Describe it like you're explaining it to a friend, not writing a brochure.",
    type: "textarea",
    placeholder: "A coaching program, a course, a service...",
    required: true,
  },
  {
    key: "audience",
    section: "Who you help",
    question: "Who is this for?",
    helper: "The more specific, the better every headline lands — age, situation, what they've already tried.",
    type: "textarea",
    placeholder: "Describe your ideal customer.",
    required: true,
  },
  {
    key: "awareness_level",
    section: "Who you help",
    question: "How much does your audience already know?",
    helper:
      'Not sure? "Problem-aware" is a safe default — most people know they have the problem, just not your solution yet.',
    type: "choice",
    required: true,
    choices: [
      { value: "Unaware", label: "Totally unaware", hint: "They don't even know they have this problem yet." },
      { value: "Problem-Aware", label: "Problem-aware", hint: "They know the problem, but not that a solution exists." },
      { value: "Solution-Aware", label: "Solution-aware", hint: "They know solutions exist, but not about you." },
      { value: "Product-Aware", label: "Product-aware", hint: "They know about you, but haven't decided to buy." },
      { value: "Most Aware", label: "Ready to buy", hint: "They just need the right offer to say yes." },
    ],
  },
  {
    key: "pain_points",
    section: "Who you help",
    question: "What's the biggest problem they're dealing with right now?",
    type: "textarea",
    required: true,
  },
  {
    key: "desired_transformation",
    section: "Who you help",
    question: "If this works perfectly for them, what does life look like afterward?",
    helper: "This is the transformation — the actual thing they're buying, not the product itself.",
    type: "textarea",
    required: true,
  },
  {
    key: "category",
    section: "What makes you different",
    question: "What category would you put your business in?",
    type: "text",
    placeholder: "e.g. online coaching, SaaS tool, local service",
    required: true,
  },
  {
    key: "differentiator",
    section: "What makes you different",
    question: "What makes you different from everyone else doing something similar?",
    type: "textarea",
    required: true,
  },
  {
    key: "unique_mechanism",
    section: "What makes you different",
    question: "Do you have a specific method or system that gets results?",
    helper: 'Give it a name if you can — "The 3-Layer Momentum System," not just "my approach."',
    type: "textarea",
    required: true,
  },
  {
    key: "core_promise",
    section: "The big promise",
    question: "In one sentence, what's the big promise you're making?",
    helper: '"Get [result] in [time] without [pain]."',
    type: "textarea",
    required: true,
  },
  {
    key: "outcomes",
    section: "The big promise",
    question: "What are the top 3-5 specific results people get?",
    type: "textarea",
    required: true,
  },
  {
    key: "price",
    section: "Your offer",
    question: "What does it cost?",
    helper: "Even a rough number helps — without it, the AI has to guess.",
    type: "text",
    placeholder: "e.g. $1,997 one-time or $297/month",
    required: true,
  },
  {
    key: "cta",
    section: "Your offer",
    question: "What do you want someone to actually DO after seeing this?",
    type: "text",
    placeholder: "e.g. Book a call, Buy now, Apply today",
    required: true,
  },
];

// Shown after the required walk, all skippable — extra detail that sharpens the copy but isn't
// needed to start generating.
export const GUIDED_OPTIONAL_QUESTIONS: GuidedQuestion[] = [
  {
    key: "offer_name",
    section: "A bit more detail (optional)",
    question: "Does your webinar or offer have a name yet?",
    helper: "Not sure? Skip this — the Offer Builder can suggest one later.",
    type: "text",
    required: false,
  },
  {
    key: "proof",
    section: "A bit more detail (optional)",
    question: "Any proof you can point to — results, testimonials, numbers?",
    type: "textarea",
    required: false,
  },
  {
    key: "guarantee",
    section: "A bit more detail (optional)",
    question: "Do you offer any kind of guarantee?",
    type: "textarea",
    required: false,
  },
  {
    key: "bonuses",
    section: "A bit more detail (optional)",
    question: "Any bonuses included with the offer?",
    type: "textarea",
    required: false,
  },
  {
    key: "scarcity_urgency",
    section: "A bit more detail (optional)",
    question: "Any real deadline, limited spots, or price increase?",
    type: "textarea",
    required: false,
  },
  {
    key: "false_beliefs",
    section: "A bit more detail (optional)",
    question: "Any objections or false beliefs that hold people back?",
    type: "textarea",
    required: false,
  },
  {
    key: "enemy",
    section: "A bit more detail (optional)",
    question: "Is there a common enemy or villain your message pushes against?",
    helper: 'e.g. "hustle culture," "one-size-fits-all diets."',
    type: "textarea",
    required: false,
  },
  {
    key: "competitive_alternatives",
    section: "A bit more detail (optional)",
    question: "What do people do instead of buying from you today?",
    type: "textarea",
    required: false,
  },
  {
    key: "existing_assets",
    section: "A bit more detail (optional)",
    question: "Do you already have an email list, social following, or past testimonials?",
    type: "textarea",
    required: false,
  },
  {
    key: "discovery_notes",
    section: "A bit more detail (optional)",
    question: "Anything else worth knowing before we generate your assets?",
    type: "textarea",
    required: false,
  },
];
