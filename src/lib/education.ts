// Plain-English "why this matters" explainers for the marketing-framework jargon scattered
// across the discovery brief — keyed by the same field name used in DiscoveryForm.tsx,
// GuidedIntake.tsx, and the projects table itself, so one dictionary covers both entry points.
// Each entry answers the question a total beginner actually has: not "what do I type here" (the
// existing per-field hint already covers that) but "why does the AI even need this, and what
// happens if I skip it."

export interface FieldEducation {
  why: string;
  usedIn?: string;
}

export const FIELD_EDUCATION: Record<string, FieldEducation> = {
  offer_name: {
    why: "A named offer feels like a real product, not a vague idea — 'The 30-Day Momentum Method' sells better than 'my coaching program' because it sounds like something specific that other people have already joined.",
    usedIn: "Headlines, ads, and the webinar title across every asset.",
  },
  audience: {
    why: "Every generator writes as if it's talking to one specific person, not a crowd. The more precise this is, the less generic every headline and story sounds — vague audiences produce vague copy.",
    usedIn: "Every generator.",
  },
  existing_assets: {
    why: "The AI won't invent proof or reuse an audience you don't have. Telling it what already exists (a list, testimonials, past content) lets it point to real leverage instead of starting from zero.",
  },
  awareness_level: {
    why: "This is the single biggest lever in direct-response marketing: someone who's never heard of your solution needs to be taught the problem first, while someone who's ready to buy just needs the offer. Picking the wrong level makes every headline either preachy (too basic) or confusing (too advanced) for where your audience actually is.",
    usedIn: "Webinar Blueprint, VSL Script, Landing Page headline and hook.",
  },
  pain_points: {
    why: "Copy that mirrors a prospect's own words back to them ('I've tried everything and nothing sticks') builds trust instantly — generic pain points read as sales talk. This is why direct quotes from real conversations beat textbook descriptions.",
    usedIn: "Hooks, ad copy, and the Problem section of the webinar/VSL.",
  },
  false_beliefs: {
    why: "Every sale you don't make is usually a false belief you never addressed out loud — 'this won't work for me because...'. Naming these lets the AI pre-handle objections in the copy itself, before a prospect ever has to ask.",
    usedIn: "Objection-handling sections in the webinar, VSL, and offer stack.",
  },
  desired_transformation: {
    why: "People buy the after, not the product. This is the actual thing being sold — describing life once the problem is solved, not the mechanics of your solution — and it's what makes a promise feel real instead of like a feature list.",
    usedIn: "Core promise, headlines, and the close.",
  },
  category: {
    why: "Naming the category tells a prospect what shelf to mentally put you on before you've said anything else — it sets their expectations for price, format, and what 'normal' looks like, so the rest of your pitch isn't fighting confusion about what this even is.",
  },
  enemy: {
    why: "Giving people something to be against — a bad habit, a broken industry norm, a competitor's flawed method — creates instant alignment ('finally, someone gets it') that a purely positive pitch can't. Optional, but it's one of the fastest ways to make a message feel different from everyone else's.",
  },
  differentiator: {
    why: "Without this, every generator defaults to generic 'we care about our clients' language. This is the actual reason someone picks you over a competitor doing something similar — the AI needs it stated plainly to argue it convincingly.",
    usedIn: "Positioning sections and objection handling.",
  },
  competitive_alternatives: {
    why: "You're not just competing with other coaches or products — you're competing with 'doing nothing' and 'figuring it out myself.' Naming what people do instead of buying lets the copy address the real alternative, not a strawman competitor.",
  },
  unique_mechanism: {
    why: "'My approach' sounds like everyone else's approach. A named method or system ('The 3-Layer Momentum System') makes your result sound repeatable and ownable — it's the difference between 'trust me' and 'here's exactly how it works.'",
    usedIn: "Webinar Blueprint's core content section, VSL, and Landing Page.",
  },
  core_promise: {
    why: "One sentence, one outcome — this is what every headline, subject line, and ad ultimately compresses down to. If this is vague or covers too much at once, everything built from it inherits that vagueness.",
    usedIn: "Headlines across every generator.",
  },
  outcomes: {
    why: "Specific, listable results ('lose 15 lbs in 8 weeks' beats 'get healthier') are what make a promise sound believable instead of like marketing hype — concrete numbers and outcomes are what a skeptical reader actually scans for.",
  },
  proof: {
    why: "Nothing in a pitch overcomes skepticism like real evidence. The AI is instructed to use only what you give it here, verbatim, never invented — so what you list here directly caps how convincing the proof section can be.",
  },
  scarcity_urgency: {
    why: "A genuine reason to act now (real deadline, real limited spots) is what turns 'I'll think about it' into a decision today. Invented urgency reads as fake and erodes trust, which is why this only uses what's actually true for your offer.",
  },
  funnel_type: {
    why: "What your call-to-action actually leads to changes what the confirmation page needs to say — someone who just booked a call needs different reassurance than someone who just bought or just registered for a webinar. This one field is what makes your Thank You Page match your real funnel instead of being generic.",
    usedIn: "Thank You Page copy and structure.",
  },
  guarantee: {
    why: "A guarantee removes the biggest hidden objection — 'what if this doesn't work for me?' — before it's even asked. Skippable if you don't offer one, but if you do, it's one of the highest-leverage lines in the whole pitch.",
  },
  bonuses: {
    why: "Bonuses shift the frame from 'is this worth the price' to 'look how much I'm getting' — they make the value stack feel larger without changing the price itself.",
  },
  cta: {
    why: "Every asset needs to end pointing at exactly one action. A vague or missing CTA is one of the most common reasons a page with great copy still doesn't convert — people rarely do the next right thing unless they're told exactly what it is.",
  },
};
