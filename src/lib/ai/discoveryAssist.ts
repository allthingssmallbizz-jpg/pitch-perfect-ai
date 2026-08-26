// Per-field AI Assist for the project discovery form — ported from the Lovable prototype's
// wizard-assist-dialog / wizard-field-guidance. When a user is stuck on a field (doesn't know
// how to answer, or wants a more professional pass), they can describe their situation in
// plain language and get a drafted answer for that ONE field, grounded in expert guidance
// about what a strong answer to that specific field looks like.

export const DISCOVERY_ASSIST_CREDIT_COST = 1;
export const DISCOVERY_ASSIST_MAX_OUTPUT_TOKENS = 600;

export type DiscoveryFieldType = "text" | "textarea" | "select";

// Every entry teaches the model WHAT a great answer to THIS specific field looks like, what to
// avoid, and a concrete exemplar. Keys match the Project discovery field names exactly
// (src/types/database.ts) — this is the same field set as the Lovable prototype's wizard.
type FieldGuidance = {
  whatThisFieldIs: string;
  whatGreatLooksLike: string;
  avoid: string;
  exemplar: string;
};

export const DISCOVERY_FIELD_GUIDANCE: Record<string, FieldGuidance> = {
  business_name: {
    whatThisFieldIs: "The literal brand/business name the user operates under.",
    whatGreatLooksLike: "- Just the name, no tagline\n- Proper capitalization",
    avoid:
      "Do NOT invent a name if the user hasn't stated one — ask them to type it. If the user's input contains a name, return it verbatim. Never write a description here.",
    exemplar: "Ironclad Coaching",
  },
  industry: {
    whatThisFieldIs: "The specific niche + who it serves. NOT a generic industry label.",
    whatGreatLooksLike:
      "- Format: '[Method/service] for [specific audience] who [specific situation]'\n- One sentence, under 20 words\n- Concrete enough that a stranger instantly knows who it's for",
    avoid: "Vague labels like 'coaching' or 'marketing'. Never 'helping people achieve their goals'.",
    exemplar: "High-ticket sales coaching for solo consultants stuck under $10k/mo who hate cold outreach.",
  },
  product: {
    whatThisFieldIs: "The actual thing being sold — format, duration, deliverables, delivery model.",
    whatGreatLooksLike:
      "- Name the format (course / group program / 1:1 / SaaS / done-for-you)\n- Duration or scope (12 weeks, 90 days, lifetime access)\n- 3-5 concrete inclusions (calls, community, templates, audits)\n- Delivery cadence",
    avoid: "Marketing fluff about 'transformation'. This field is about WHAT they get, not why it's great.",
    exemplar:
      "12-week group coaching program. Weekly 90-min live strategy calls, private Slack community, done-for-you sales script library, 2 one-on-one intensives, and lifetime access to recordings.",
  },
  audience: {
    whatThisFieldIs: "A sharp avatar of the exact person the offer is for.",
    whatGreatLooksLike:
      "- Demographic: age range, gender if relevant, role/title, income tier, life stage\n- Psychographic: what they believe, what they've already tried, what they resent\n- 1-2 sentences of 'a day in their life' texture",
    avoid: "'Everyone who wants to grow' or 'small business owners'. Too broad = useless.",
    exemplar:
      "Female course creators, 32-45, doing $5k-$20k/mo, burned out from launch-and-crash cycles. They've bought Amy Porterfield, still feel unqualified, and secretly think their offer isn't good enough — it is, their positioning is.",
  },
  existing_assets: {
    whatThisFieldIs: "A candid inventory of marketing assets the user already has.",
    whatGreatLooksLike:
      "- Short bulleted list\n- Include email list size, social followings with platform, past testimonials count, existing funnels, ad spend history\n- Say 'none' explicitly for missing categories",
    avoid: "Aspirational assets. Only list what actually exists.",
    exemplar:
      "- Website: yes (dated)\n- Email list: 1,400 subs, ~18% open\n- Instagram: 6.2k followers\n- Testimonials: 12 written, 3 video\n- Paid ads: never run\n- Case studies: 2 documented",
  },
  awareness_level: {
    whatThisFieldIs: "Where the prospect sits on Eugene Schwartz's 5-stage awareness ladder.",
    whatGreatLooksLike: "- Return EXACTLY one of the provided options verbatim\n- Match to how the prospect currently thinks, not where you wish they were",
    avoid: "Explanations. Just the option text.",
    exemplar: "Problem-Aware",
  },
  pain_points: {
    whatThisFieldIs: "The specific, felt frustrations the prospect experiences — in their own language.",
    whatGreatLooksLike:
      "- 3-5 bullets\n- Written in first-person or observed voice: 'I can't seem to...', 'Every time I try to...'\n- Include emotional AND practical pain\n- Specific scenarios, not abstractions",
    avoid: "'Lack of confidence' — too abstract. Instead: 'Freezes and reschedules when it's time to record a sales video.'",
    exemplar:
      "- Wakes up already behind, checks Slack before coffee, resents her own business\n- Has 4 half-finished funnels, none launched\n- Quotes prices 30% too low then over-delivers to compensate\n- Sees peers announcing $100k months and secretly wonders if theirs are real\n- Books discovery calls, then talks herself out of the pitch",
  },
  false_beliefs: {
    whatThisFieldIs: "Wrong assumptions the prospect holds that stop them from buying or succeeding.",
    whatGreatLooksLike:
      "- 3-5 bullets, each a single sentence starting with the belief\n- Pair each with a one-line reframe if useful\n- Focus on beliefs about the problem, the solution category, or themselves",
    avoid: "Objections to price. Those belong under sales objections, not beliefs.",
    exemplar:
      "- 'I need a bigger audience before I can charge more.' (Actually: positioning beats volume every time.)\n- 'Cold outreach is spammy.' (Only when it's untargeted.)\n- 'I'm not experienced enough to coach at $5k.' (Results, not tenure, price the offer.)",
  },
  desired_transformation: {
    whatThisFieldIs: "The vivid 'after' state — how the prospect's life measurably changes.",
    whatGreatLooksLike:
      "- Specific, sensory, measurable\n- Mix external results (revenue, hours saved) and internal (confidence, identity)\n- Present-tense 'they now...' framing works well",
    avoid: "'Feel better' or 'be successful'. Zero specificity = zero pull.",
    exemplar:
      "Wakes up at 6, works 4 focused hours, closes 2 out of every 5 sales calls at $8k. Has 90 days of runway in the bank for the first time. Turns down clients who don't fit. Calls herself a coach without flinching.",
  },
  category: {
    whatThisFieldIs: "The market category the offer competes in — how the buyer would Google it.",
    whatGreatLooksLike: "- 2-5 words\n- Uses language the buyer already uses\n- Narrow enough to own, broad enough to be searched",
    avoid: "Made-up category names nobody searches for.",
    exemplar: "High-ticket sales coaching",
  },
  enemy: {
    whatThisFieldIs: "The common industry idea, method, guru archetype, or status quo you position against.",
    whatGreatLooksLike:
      "- Name a specific approach or archetype, not a competitor company\n- One sentence explaining WHY it fails the prospect\n- Should make loyal followers of that approach uncomfortable",
    avoid: "Attacking named people. Attack the METHOD.",
    exemplar:
      "The 'post consistently and they'll come' content-marketing dogma — it turns founders into unpaid media companies while their pipeline stays empty.",
  },
  differentiator: {
    whatThisFieldIs: "The one thing that makes this offer measurably different from every alternative.",
    whatGreatLooksLike:
      "- Start with the contrast: 'Unlike [X], we...'\n- Anchor to a mechanism or process the buyer can visualize\n- One tight paragraph",
    avoid: "'Better results' or 'more personalized' — every competitor claims that.",
    exemplar:
      "Unlike group coaching that dumps templates and hopes you implement, we run a 3-week Sales Sprint where you record real pitches, we tear them down within 24 hours, and you re-record until close rate crosses 30%. You leave with a working sales motion, not a course library.",
  },
  competitive_alternatives: {
    whatThisFieldIs: "What the prospect is currently doing INSTEAD of buying this — including DIY and doing nothing.",
    whatGreatLooksLike: "- 3-5 bullets\n- Include: DIY approach, cheaper courses, hiring an agency, doing nothing\n- Note the hidden cost of each",
    avoid: "Only listing direct competitors. The biggest competitor is usually inaction.",
    exemplar:
      "- YouTube tutorials + free templates (costs 6 months, zero accountability)\n- $497 self-paced courses (98% never finish)\n- Hiring a fractional CMO at $8k/mo (fixes marketing but not sales)\n- Waiting until 'the market improves' (18 months of lost revenue)",
  },
  unique_mechanism: {
    whatThisFieldIs: "The named framework, method, or system that delivers the result. This is the 'how'.",
    whatGreatLooksLike: "- Give it a proprietary NAME (2-4 words, memorable)\n- 3-5 step process or pillars\n- Each step is a concrete action, not a concept",
    avoid: "Unnamed 'proven system' language. If it has no name, it has no mechanism.",
    exemplar:
      "The Signal Method — a 4-phase system: (1) Positioning Audit to identify the highest-paying wedge, (2) Offer Rebuild to price for outcome not time, (3) Pipeline Reset to install one repeatable inbound source, (4) Close Loop where every call is reviewed and re-run until conversion holds.",
  },
  core_promise: {
    whatThisFieldIs: "The one specific, measurable outcome the offer guarantees in a defined timeframe.",
    whatGreatLooksLike: "- Format: '[Specific result] in [timeframe] without [common pain/sacrifice]'\n- Under 20 words\n- Quantified where possible",
    avoid: "'Transform your business.' No number, no timeframe, no promise.",
    exemplar: "Book 10 qualified $5k+ sales calls in 60 days without running paid ads or posting daily.",
  },
  outcomes: {
    whatThisFieldIs: "The stack of concrete results the buyer gets — external, internal, and status.",
    whatGreatLooksLike: "- 5-8 bullets\n- Mix quantifiable (revenue, time, size) with felt (confidence, identity, freedom)\n- Each bullet under 12 words",
    avoid: "Feature lists. Outcomes are what the feature CAUSES.",
    exemplar:
      "- Predictable $30k-$50k months within 90 days\n- 4-hour workdays without pipeline collapsing\n- A sales motion your future hires can run\n- Charge 3x more without losing conversion\n- Turn down bad-fit clients without anxiety\n- Weekends fully offline\n- Recognized as the go-to in your niche",
  },
  proof: {
    whatThisFieldIs: "Concrete evidence that the promise is real — testimonials, case studies, data, credentials, media.",
    whatGreatLooksLike:
      "- Bullet list of what actually exists\n- Include numbers where possible (X testimonials, Y case studies, Z years experience)\n- Note any press or notable clients",
    avoid: "Making up proof. If the user said 'none', reflect that honestly and suggest what to gather first.",
    exemplar:
      "- 47 written testimonials, 12 video\n- 3 documented case studies (2 with 5x revenue in 90 days)\n- 8 years running sales teams\n- Featured in Entrepreneur and Forbes Council\n- 94% of past clients renew for phase 2",
  },
  price: {
    whatThisFieldIs: "The exact price point and billing structure of THIS offer.",
    whatGreatLooksLike: "- Include amount and structure (one-time, monthly, pay-in-full vs. installments)\n- Under 15 words",
    avoid: "Ranges like '$2k-$10k'. Pick one price.",
    exemplar: "$4,997 one-time, or 3 payments of $1,797.",
  },
  guarantee: {
    whatThisFieldIs: "The risk-reversal the buyer gets if the offer doesn't deliver.",
    whatGreatLooksLike: "- Name the guarantee type (money-back, results-based, work-with-you-until)\n- State the specific trigger and timeframe\n- 2-3 sentences",
    avoid: "'Satisfaction guaranteed.' Meaningless.",
    exemplar:
      "Book-10-Calls Guarantee: complete the 60-day sprint, do the daily outreach reps, and if you haven't booked 10 qualified sales calls, we work with you 1:1 free until you do — or refund every dollar. No fine print.",
  },
  bonuses: {
    whatThisFieldIs: "Additional deliverables stacked on top of the core offer to increase perceived value.",
    whatGreatLooksLike:
      "- 3-5 bonuses, each with a name and dollar value\n- Each bonus solves a specific adjacent objection\n- Format: 'Bonus name — what it is — ($X value)'",
    avoid: "PDF checklists valued at $997. Buyers laugh at inflated PDF pricing.",
    exemplar:
      "- Sales Call Library — 40 recorded closes with breakdowns ($1,200 value)\n- 30-day access for objection-handling ($800 value)\n- DFY CRM + pipeline template ($600 value)\n- Live 'Close Week' clinic each month for 6 months ($1,500 value)",
  },
  scarcity_urgency: {
    whatThisFieldIs: "The real, honest reason the buyer must act now.",
    whatGreatLooksLike:
      "- One specific mechanism: cohort start date, seat cap, price increase, bonus expiry\n- State the number and the deadline\n- Must be TRUE — fake scarcity kills trust",
    avoid: "'Limited time only!' with no actual limit.",
    exemplar:
      "Next cohort starts March 3rd, capped at 20 founders so every call gets hot-seat time. Enrollment closes Feb 26 or when the 20th seat is filled — whichever comes first. Price rises to $5,997 for the following cohort.",
  },
  cta: {
    whatThisFieldIs: "The single next action you want the prospect to take.",
    whatGreatLooksLike: "- 2-5 words, imperative verb\n- Matches the offer's sales motion (application call for high-ticket, buy now for low-ticket)",
    avoid: "'Learn more' — vague, low commitment.",
    exemplar: "Apply for the March cohort",
  },
  presenter_mission: {
    whatThisFieldIs: "The presenter's own one-line answer to 'what do you do' — mission, not offer copy.",
    whatGreatLooksLike: "- One or two sentences, first person\n- Who they help + the core shift they create\n- Sounds like something they'd actually say out loud, not a tagline",
    avoid: "Restating the product description. This is about the PERSON's mission, not the offer's features.",
    exemplar: "I help overwhelmed solo consultants turn one-on-one expertise into a business that runs without them trading every hour for a dollar.",
  },
  presenter_years_experience: {
    whatThisFieldIs: "How long the presenter has actually been doing this work.",
    whatGreatLooksLike: "- A number + unit, optionally with a starting point ('since 2014')\n- Honest — including early/less-established years counts",
    avoid: "Vague ranges like 'many years'. Give an actual number.",
    exemplar: "9 years (started coaching in 2015 after 6 years in corporate sales)",
  },
  presenter_credentials: {
    whatThisFieldIs: "Formal credentials — certifications, degrees, licenses — that back the presenter's authority.",
    whatGreatLooksLike: "- Bullet list, most relevant/impressive first\n- Include the granting body/institution\n- If genuinely none exist, say so plainly rather than leaving it blank",
    avoid: "Inflating informal experience into a 'credential'. A client roster is proof, not a credential — that belongs in Proof/signature win, not here.",
    exemplar: "- Certified NLP Practitioner (ABNLP)\n- B.S. Exercise Science, Penn State\n- 200hr Yoga Alliance certification",
  },
  presenter_origin_story: {
    whatThisFieldIs: "How the presenter actually ended up in this industry — their real origin story.",
    whatGreatLooksLike: "- Start with the moment/situation that pulled them in, not a resume timeline\n- Include what they were doing before, and the specific trigger that changed direction\n- Honest and a little unpolished reads as more credible, not less",
    avoid: "A LinkedIn-style career summary. This should read like something told out loud, not a bio paragraph.",
    exemplar: "I was 40 pounds overweight and quietly furious about it when a client I was coaching on sales asked why I didn't practice what I preached about discipline. That question wrecked me — and six months later I'd built the exact system I now teach.",
  },
  presenter_signature_win: {
    whatThisFieldIs: "The single biggest, most specific transformation the presenter has created for one real client.",
    whatGreatLooksLike: "- ONE story, not a list of wins\n- Specific before/after — numbers, timeframe, what changed in their life\n- In the client's own words if a quote exists",
    avoid: "Vague 'helped hundreds of clients' claims — that's aggregate proof and belongs in the Proof field. This is one concrete story.",
    exemplar: "A client came to me making $3k/month after 2 years of trying alone. 90 days later she closed a $47k contract — her first five-figure month ever — and told me she cried in her car afterward because she finally believed she wasn't a fraud.",
  },
  presenter_setback_story: {
    whatThisFieldIs: "A real setback, failure, or low point the presenter hit while building toward their goals — and how they recovered.",
    whatGreatLooksLike: "- Name the actual failure specifically (lost money, lost a client, publicly embarrassed, nearly quit)\n- Don't rush past the low point — sit in it briefly before the turnaround\n- End on the specific decision or shift that turned it around, not just 'and then it got better'",
    avoid: "A humble-brag disguised as a setback ('my only flaw is I work too hard'). This needs a real, uncomfortable low point to do its job.",
    exemplar: "My first launch made $340 after three months of work — I'd built the whole thing around what I thought was smart instead of what my actual audience needed. I almost shut it down. What changed it was finally interviewing 20 past clients instead of guessing, and rebuilding the offer from what they actually said.",
  },
  presenter_income_goal_6mo: {
    whatThisFieldIs: "The presenter's own personal income goal for the next 6 months — internal context, not customer-facing copy.",
    whatGreatLooksLike: "- A specific number with a timeframe/unit\n- Realistic enough to be usable for authentic vision-casting if a generator ever references it",
    avoid: "Overthinking this one — it's a number, not a pitch.",
    exemplar: "$25k/month by the end of Q2",
  },
  presenter_income_goal_12mo: {
    whatThisFieldIs: "The presenter's own personal income goal for the next 12 months — internal context, not customer-facing copy.",
    whatGreatLooksLike: "- A specific number with a timeframe/unit\n- Should represent real ambition, not just 6-month goal x2 by default",
    avoid: "Overthinking this one — it's a number, not a pitch.",
    exemplar: "$50k/month, with the first hire brought on by month 9",
  },
  presenter_mission_why: {
    whatThisFieldIs: "Why this work matters to the presenter personally — beneath the business reasons.",
    whatGreatLooksLike: "- Personal, specific, often tied to their own past struggle or a person in their life\n- Should explain WHY they'd keep doing this even if it paid less",
    avoid: "Restating the mission statement in different words. This is the emotional root underneath the mission, not a rephrase of it.",
    exemplar: "My dad worked himself into a heart attack at 52 believing that's just what success costs. I do this because I refuse to let that be the only model my clients have for what achievement looks like.",
  },
  presenter_recognition: {
    whatThisFieldIs: "Third-party recognition — press, podcasts, stages, awards — that exists independent of the presenter's own claims.",
    whatGreatLooksLike: "- Bullet list, name the actual outlet/stage/award\n- Only what's real and verifiable\n- 'None yet' is a completely fine, honest answer",
    avoid: "Inflating a single guest podcast appearance into 'featured media personality'. Keep it proportionate to what actually happened.",
    exemplar: "- Guest on The Game Changers Podcast (2023)\n- Spoke at Traffic & Conversion Summit, breakout session\n- Featured in a local business journal profile",
  },
  presenter_relatable_detail: {
    whatThisFieldIs: "One small, ordinary, human detail about the presenter that has nothing to do with their expertise.",
    whatGreatLooksLike: "- Genuinely mundane — family, a hobby, a pet, a habit\n- Specific beats generic ('runs 5ks with my dog Biscuit on Saturdays' beats 'I like running')",
    avoid: "Anything that's secretly another credibility flex. This should read as purely human, not another achievement.",
    exemplar: "I'm a terrible cook and have burned water — my husband does all the cooking and I take zero credit for it.",
  },
};

export type DiscoveryAssistInput = {
  fieldKey: string;
  fieldLabel: string;
  fieldType: DiscoveryFieldType;
  fieldPlaceholder?: string;
  options?: string[];
  userPrompt: string;
  otherAnswers: Record<string, string>;
};

// Returns a system/user prompt pair for generateAsset(). Deliberately does NOT go through
// buildSystemPrompt()/the knowledge library — this is a narrow, single-field completion task,
// not a full asset generation, so it gets its own tight, single-purpose system prompt instead.
export function buildDiscoveryAssistPrompt(input: DiscoveryAssistInput): { system: string; user: string } {
  const { fieldKey, fieldLabel, fieldType, fieldPlaceholder, options, userPrompt, otherAnswers } = input;

  const contextLines = Object.entries(otherAnswers)
    .filter(([k, v]) => k !== fieldKey && v && v.trim().length > 0)
    .map(([k, v]) => `- ${k}: ${v.trim().slice(0, 500)}`)
    .join("\n");

  const optionsBlock =
    options && options.length
      ? `\nThe user MUST pick exactly one of these options (return only the option text, nothing else):\n${options.map((o) => `- ${o}`).join("\n")}`
      : "";

  const lengthGuidance =
    fieldType === "text"
      ? "Return a single concise line (under 120 characters). No markdown, no quotes, no preamble."
      : fieldType === "select"
        ? "Return ONLY the chosen option text verbatim. No explanation."
        : "Return 2-5 short sentences OR a tight bulleted list. Plain text (light markdown OK). No preamble, no headings, no quotes around the answer.";

  const guidance = DISCOVERY_FIELD_GUIDANCE[fieldKey];
  const fieldExpertBlock = guidance
    ? `
FIELD-SPECIFIC EXPERT BRIEFING — applies ONLY to the "${fieldLabel}" field. Do not answer any other question.

What this field is: ${guidance.whatThisFieldIs}

What a great answer looks like:
${guidance.whatGreatLooksLike}

Common failure modes to AVOID: ${guidance.avoid}

GOLD-STANDARD EXEMPLAR (match this depth, specificity, and format — do NOT copy the content; adapt to the user's actual business):
"""
${guidance.exemplar}
"""
`
    : "";

  const system = `You are a senior direct-response marketing strategist embedded as an inline field assistant in a project discovery form.

CRITICAL RULES:
1. You are ONLY answering ONE specific field — "${fieldLabel}". Nothing else.
2. Your entire output must be a valid, ready-to-paste value for THAT field. Not a summary of the business. Not an explanation. Not multiple fields.
3. Match the semantic type of the field: a "name" field gets a name, a "price" field gets a price, a "list of pain points" gets pain points — never mix.
4. Use the user's own words/business details as the raw material. Do not invent facts about their business — if info is missing, write a strong professional answer that is still consistent with what they've said elsewhere.
5. Never restate the question. Never say "Here is your answer" or "Great question". Never ask a question back.`;

  const user = `THE ONE FIELD YOU MUST ANSWER
Field label: ${fieldLabel}
Field key: ${fieldKey}
Field type: ${fieldType}
${fieldPlaceholder ? `Field placeholder shown to user: ${fieldPlaceholder}\n` : ""}${optionsBlock}
${fieldExpertBlock}
WHAT THE USER TOLD YOU (their raw input, may be vague, misspelled, or empty):
"""
${userPrompt.trim() || "(the user did not add extra context — infer a strong, specific professional answer from the other answers below and stay consistent with them)"}
"""

OTHER ANSWERS THE USER HAS ALREADY GIVEN IN THIS PROJECT (use for consistency, do NOT re-answer these — only answer the "${fieldLabel}" field):
${contextLines || "(none yet)"}

FINAL OUTPUT INSTRUCTIONS:
- Output ONLY the value to paste into the "${fieldLabel}" field. Nothing before, nothing after.
- Be specific and concrete. Reference the user's actual industry/audience/product where relevant.
- Stay consistent with the other answers above.
- ${lengthGuidance}`;

  return { system, user };
}
