import type { GeneratorAssetType } from "@/lib/ai/generators";
import type { PresenterBio, Project } from "@/types/database";

// Swipe-file templates for the /templates page — pre-filled example briefs so a new user can
// clone one, tweak the details, and generate immediately instead of starting from a blank
// discovery form. Ported from the Lovable prototype's TEMPLATES list, remapped onto this app's
// full discovery field set (src/types/database.ts).
//
// Every field in the discovery brief is filled in for every template (not just the required
// ones) — the point of a template is to let someone demo every agent end-to-end for a realistic
// niche without hitting a "still need before you can generate" wall or a blank Offer/Positioning
// section partway through.
export type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  assetType: GeneratorAssetType;
  answers: Partial<Project>;
  // Presenter Bio is account-level (one row per user, shared across every project — see
  // src/lib/ai/presenterBio.ts), not project-scoped, so it can't just be spread into `answers`.
  // createProjectFromTemplate only seeds this into presenter_bios when the user's own bio is
  // still completely empty — never overwriting a real bio they've already filled in, same rule
  // Website Import and Offer Builder already follow for existing discovery fields.
  presenterBio: Partial<PresenterBio>;
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
      offer_name: "The Momentum Method: Reclaim Your Week in 8",
      audience:
        "Ambitious professionals aged 30-45 stuck at a career plateau who feel exhausted and unfulfilled despite outward success.",
      existing_assets:
        "Email list of 1,100 past clients/leads; Instagram 8k followers; 12 written testimonials, 3 video; ran 2 live cohorts so far.",
      awareness_level: "Problem-Aware",
      pain_points:
        "Says yes to everything and resents it. Checks Slack before coffee. Hit their income ceiling 18 months ago and hasn't moved. Watches peers get promoted or scale while feeling stuck doing more of the same. Exhausted by 8pm most nights, too wired to actually rest.",
      false_beliefs: "\"I've tried coaching before and it didn't stick.\"",
      desired_transformation:
        "From overworked and stuck to energized, in-demand, and earning more with less time.",
      category: "Online coaching",
      enemy:
        "The 'hustle harder' productivity culture that treats burnout as the price of ambition instead of a system failure.",
      differentiator:
        "Unlike generic 'mindset' coaching, the 3-Layer Momentum System is a weekly operating cadence, not a philosophy — you leave every session with the exact 3 moves for that week, not homework you'll skip.",
      competitive_alternatives:
        "Generic business coaches selling tactics with no cadence; $50 productivity courses they buy and never finish; therapy (helps the feelings, doesn't fix the calendar); doing nothing and hoping Q3 is different.",
      unique_mechanism:
        "The 3-Layer Momentum System (Clarity, Cadence, Conversion) — a proprietary weekly cadence that compounds output without adding hours.",
      core_promise: "Reclaim 10+ hours a week and double your income in 90 days without burning out.",
      outcomes:
        "- 10+ hours back per week within 30 days\n- A repeatable weekly cadence instead of constant fire-fighting\n- 38% average income lift in 90 days\n- Delegate or cut the work that was never worth their time\n- Actually feel energized at the end of a workday again",
      proof:
        "42 clients over 3 years; average income lift of 38% in 90 days; 3 detailed case studies (Sarah, Marcus, Priya).",
      price: "$1,997",
      guarantee: "Full refund inside 14 days if you complete week 1 and don't feel more clarity.",
      bonuses:
        "- Momentum Planner (physical + digital) — $97 value\n- 'Delegate or Delete' audit template — $147 value\n- Private community access for the full 8 weeks — $200 value",
      scarcity_urgency:
        "Cohorts run quarterly, capped at 20 seats so everyone gets hot-seat time in the weekly call. Enrollment closes when the cohort fills or one week before the start date, whichever comes first.",
      cta: "Book your free Momentum Call",
      discovery_notes:
        "Clients often say some version of 'I know what to do, I just don't do it' — the program's whole angle is cadence over content, since they don't need more information.",
    },
    presenterBio: {
      presenter_mission:
        "I help ambitious professionals stuck at a plateau get their time back and double their income without burning out even further.",
      presenter_years_experience: "7 years (since 2018, after 11 years in corporate operations)",
      presenter_credentials: "Certified Professional Co-Active Coach (CPCC); B.A. Organizational Psychology",
      presenter_origin_story:
        "I was a VP of Ops working 65-hour weeks and missed my daughter's first steps because I was on a call. That was the moment I quit chasing 'more' and started building the cadence system I now teach.",
      presenter_signature_win:
        "A client named Marcus came to me working 70-hour weeks and about to turn down a promotion out of sheer exhaustion. Eight weeks later he'd cut his hours to 45, took the promotion, and told me it was the first time work felt 'winnable' instead of endless.",
      presenter_setback_story:
        "My first attempt at this business was a $47 course that sold 6 copies in 4 months. I'd built it around what I thought sounded smart instead of what actually got a client unstuck. I nearly shut it down — what turned it around was interviewing 20 past clients and rebuilding everything around the one thing they all had in common: no cadence, just chaos.",
      presenter_income_goal_6mo: "$30k/month",
      presenter_income_goal_12mo: "$60k/month, with a second coach licensed to run cohorts",
      presenter_mission_why:
        "My dad retired at 63 having never once taken a real vacation, and told me at his retirement party he 'didn't know what to do with his time.' I refuse to let that be the ending for the people I work with.",
      presenter_recognition:
        "Guest on the Scale Without Burnout podcast; spoke at a regional coaching summit in 2023.",
      presenter_relatable_detail:
        "I still haven't beaten my own 8-year-old at chess, and he will absolutely never let me forget it.",
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
      offer_name: "Loop: Kill the Daily Standup",
      audience:
        "Engineering managers of 10-50 person distributed teams tired of Zoom fatigue and unclear priorities.",
      existing_assets:
        "Product Hunt launch (#3 Product of the Day); 40 case study interviews on file; 6,000-subscriber newsletter; active in 3 remote-work Slack communities.",
      awareness_level: "Solution-Aware",
      pain_points:
        "Team spans 3+ time zones so a live standup means someone's always joining at 7am or 9pm. Meetings run long and half the team tunes out. Manager can't tell if someone's blocked until it's already a problem. Async Slack updates get buried and nobody reads them.",
      false_beliefs: "\"My team won't actually use it.\"",
      desired_transformation:
        "From back-to-back meetings to focused deep work, with better team clarity than before.",
      category: "Team collaboration software",
      enemy:
        "The belief that 'real' team alignment requires everyone live on a call at the same time — that's exactly the assumption killing distributed teams' focus time.",
      differentiator:
        "Unlike a Slack channel or a Loom video library, Loop auto-summarizes every update AND surfaces blockers automatically — no manager has to read 12 individual videos to find the one person who's stuck.",
      competitive_alternatives:
        "A recurring Zoom standup (the default); a plain Slack thread nobody reads; Loom without any summarization or blocker detection; doing nothing and letting misalignment compound.",
      unique_mechanism:
        "AI-summarized async video updates that surface blockers automatically — no reading, no meetings.",
      core_promise: "Kill your daily standup meeting without losing visibility.",
      outcomes:
        "- Eliminate the daily standup meeting entirely\n- Blockers surface automatically instead of getting buried in Slack\n- Managers get a 2-minute daily digest instead of 30 minutes of meetings\n- Teams report better visibility than they had WITH standups\n- Works across time zones with zero live attendance required",
      proof: "3,400 teams onboarded; 89% still active at 30 days; case studies from Notion, Linear, and a YC batch.",
      price: "$12/user/month, 14-day free trial (no card required)",
      guarantee: "Full 14-day trial with no card. Cancel any time inside the app.",
      bonuses:
        "- Free migration/setup call for teams of 10+ — $300 value\n- Slack + Linear/Jira integration included at every tier\n- 30-day onboarding concierge in a shared Slack channel",
      scarcity_urgency:
        "None manufactured — the trial itself (14 days, no card) is the only mechanism; pricing increases 10% at the start of each quarter for new signups, existing customers grandfathered.",
      cta: "Start your 14-day free trial",
      discovery_notes:
        "Buyers are engineering managers, not individual engineers — messaging should speak to 'give your team back deep work time,' not just 'no more meetings.'",
    },
    presenterBio: {
      presenter_mission:
        "I help engineering managers of distributed teams get real alignment without a single live meeting.",
      presenter_years_experience: "5 years building Loop (previously 8 years as an engineering manager at two remote-first startups)",
      presenter_credentials: "B.S. Computer Science, Georgia Tech; no formal certifications — this is built from running distributed teams, not theory.",
      presenter_origin_story:
        "I was managing a 14-person team across 4 time zones and realized I was scheduling standups at 7am for some people and 9pm for others just so everyone could be 'present.' I built the first version of Loop for my own team before it was ever a company.",
      presenter_signature_win:
        "A 22-person engineering team at a fintech startup cut their meeting load from 6 hours/week to 45 minutes/week in their first month using Loop, and their eng lead told me it was the first quarter in two years they shipped everything on the roadmap.",
      presenter_setback_story:
        "We spent our first 8 months building a full video-call replacement platform — nobody wanted it, because the problem was never 'no video,' it was 'no time.' We nearly ran out of runway before we scrapped 80% of the product and rebuilt around async summarization alone.",
      presenter_income_goal_6mo: "$150k MRR",
      presenter_income_goal_12mo: "$400k MRR, Series A closed",
      presenter_mission_why:
        "I watched three good engineers quit my own team because the meeting load left them no time for the work they were actually hired to do. I'm building the tool I needed back then.",
      presenter_recognition:
        "Featured in a Product Hunt 'Best of Remote Work Tools' roundup; guest on the Distributed Teams podcast.",
      presenter_relatable_detail:
        "I have a genuinely embarrassing amount of houseplants for someone who travels as much as I do — my Slack status is regularly just 'watering the office.'",
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
      offer_name: "The 5-Minute Email Formula",
      audience: "Solopreneurs and course creators with a list of 500-5,000 who send emails that get ignored.",
      existing_assets:
        "12k email subscribers of their own; active in 4 creator Facebook groups; TikTok with 30k followers posting email tips.",
      awareness_level: "Problem-Aware",
      pain_points:
        "Sends emails that get maybe a 15% open rate and feels invisible. Stares at a blank subject line for 20 minutes. Has a list they're embarrassed to email because engagement is so low. Sees other creators' screenshots of big launches and assumes their list is just 'better,' not that the emails are better.",
      false_beliefs: "\"Another cheap product that won't work.\"",
      desired_transformation: "From dreading email marketing to loving it (and making money from every send).",
      category: "Digital marketing courses",
      enemy:
        "The 'just show up consistently' content-marketing advice that ignores that most creators' emails are actually boring, not just infrequent.",
      differentiator:
        "Unlike generic 'email marketing tips' content, this is one specific 3-line formula you can apply today — not a philosophy of email marketing, a plug-and-play opener.",
      competitive_alternatives:
        "Free YouTube tutorials (scattered, no system); $997 'full email marketing mastery' courses that go unfinished; ChatGPT prompts that produce generic copy; doing nothing and just posting less.",
      unique_mechanism:
        "The Curiosity Loop Framework — a 3-line opener that spikes open rates and pulls readers into the click.",
      core_promise: "Write emails your list actually opens, clicks, and buys from — in under 5 minutes each.",
      outcomes:
        "- Open rates that go from under 20% to 35%+\n- A repeatable subject-line formula, not one-off inspiration\n- Emails written in under 5 minutes instead of 45\n- A list that actually looks forward to your emails\n- More clicks and sales from the exact same list size",
      proof: "1,200+ buyers; average open rate lift from 18% to 41%; 12 real send-comparison screenshots.",
      price: "$27 (with a $197 order bump and $497 upsell)",
      guarantee:
        "30-day \"send 10 emails\" guarantee — if your open rate doesn't improve, refund + keep the product.",
      bonuses:
        "- 50 swipe-file subject lines — $47 value\n- 'Dead List Revival' 3-email sequence template — $67 value\n- Private Facebook group access — $97 value",
      scarcity_urgency:
        "Order bump ($197) and upsell ($497) pricing increase by $10 every 90 days as new bonuses are added — no fake countdown timers.",
      cta: "Get instant access for $27",
      discovery_notes:
        "Buyers are burned by past 'get rich with email' hype — copy should lean into specificity/proof over big promises.",
    },
    presenterBio: {
      presenter_mission:
        "I help solopreneurs and course creators turn a list that ignores them into a list that opens, clicks, and buys.",
      presenter_years_experience: "6 years",
      presenter_credentials:
        "No formal certifications — self-taught through running email for 3 different 6-figure info businesses before going solo.",
      presenter_origin_story:
        "I was ghostwriting emails for other creators and noticed the exact same 3-line opener kept outperforming everything else I wrote, across totally different niches. I named it the Curiosity Loop and built a product around it.",
      presenter_signature_win:
        "A course creator with a 'dead' list of 8,000 subscribers used the formula on a single re-engagement send and got a 44% open rate and $3,200 in sales from a list she'd almost given up on.",
      presenter_setback_story:
        "My first product was a $997 'complete email marketing system' that sold 4 copies in its first launch. It was too expensive and too broad for someone who'd never had a good open rate in their life. I rebuilt it as a $27 single-formula product and it's sold over 1,200 copies since.",
      presenter_income_goal_6mo: "$15k/month",
      presenter_income_goal_12mo: "$35k/month with the upsell funnel fully automated",
      presenter_mission_why:
        "I spent two years thinking I just 'wasn't a writer' because my own emails flopped, before I realized it was a formula problem, not a talent problem. I want everyone to find that out faster than I did.",
      presenter_recognition:
        "Featured in a solo creator newsletter roundup with 40k subscribers; guest on the Creator Economy Weekly podcast.",
      presenter_relatable_detail:
        "I write every single one of my own promotional emails from a coffee shop two blocks from my apartment because I apparently cannot write a good subject line at home.",
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
      offer_name: "The Growth Audit: Find Your Next $50k",
      audience: "Founders of DTC ecom brands doing $1M-$10M/year whose paid growth has stalled.",
      existing_assets:
        "40+ client case studies; LinkedIn following of 22k; featured speaker at 2 ecom conferences; existing referral network with 3 Shopify Plus partners.",
      awareness_level: "Solution-Aware",
      pain_points:
        "Ad spend keeps climbing but revenue is flat. Doesn't know if the problem is creative, offer, or retention. In-house team is stretched thin and reactive. Tried 2 agencies before that overpromised on ROAS and delivered generic reporting decks.",
      false_beliefs: "\"Every agency pitches this and delivers nothing.\"",
      desired_transformation:
        "From stalled growth and unclear where to invest ad spend, to a clear 90-day plan with prioritized levers.",
      category: "Ecommerce growth agency",
      enemy:
        "The 'just increase ad spend' advice that treats every stalled brand's problem as a media-buying problem when it's usually the offer or retention.",
      differentiator:
        "Unlike agencies that pitch 'we'll run your ads better,' the Growth Diagnostic covers all 7 growth levers before a single dollar moves — most engagements start on the wrong lever entirely.",
      competitive_alternatives:
        "In-house junior marketer stretched too thin; a cheaper freelance media buyer with no strategic view; a $15k/mo agency that only touches paid ads; doing nothing and hoping Q4 saves the year.",
      unique_mechanism:
        "The 7-point Growth Diagnostic covers offer, funnel, retention, CAC, LTV, creative, and channel mix.",
      core_promise:
        "Find $50k+ in missed revenue in your funnel in 30 minutes — with a video breakdown you can act on today.",
      outcomes:
        "- A prioritized 90-day growth plan, not a vague strategy deck\n- Clarity on which of the 7 levers is actually the bottleneck\n- 2.3x average ROAS lift within 12 months\n- A team that finally knows why last quarter underperformed\n- Confidence to reinvest in growth instead of pulling back",
      proof:
        "Averaged 2.3x ROAS lift across 40+ brands in 12 months. Named case studies from Ridge, Bearaby, and Olipop.",
      price: "Free audit → $8,500/mo retainer for a 6-month engagement.",
      guarantee: "First 30 days performance-based. Miss the KPI, you don't pay.",
      bonuses:
        "- Free 90-day growth roadmap regardless of whether they sign — $2,500 value\n- Creative teardown of their 5 best-performing ads — $1,000 value\n- Direct Slack access to the strategy lead for the first 30 days — $1,500 value",
      scarcity_urgency:
        "Only take on 4 new retainer clients per quarter to keep the strategist-to-account ratio low — audits booked beyond that queue for the following quarter.",
      cta: "Book your free Growth Audit",
      discovery_notes:
        "Buyers are founders/CMOs, skeptical from past agency experiences — lead with named case studies and specific numbers, not adjectives.",
    },
    presenterBio: {
      presenter_mission:
        "I help $1M-$10M ecom founders find exactly where their growth stalled and fix the right lever first, instead of just spending more on ads.",
      presenter_years_experience: "10 years (started running paid media in 2015, founded the agency in 2019)",
      presenter_credentials: "Meta Blueprint certified; former Head of Growth at a $40M DTC brand before going agency-side.",
      presenter_origin_story:
        "I was the in-house growth lead watching our agency burn $80k/month with a reporting deck that never explained WHY anything worked. I left to build the diagnostic-first process I wished someone had used on us.",
      presenter_signature_win:
        "A $4M/year skincare brand came to us assuming they needed more ad spend. The Growth Diagnostic found their real problem was a 22% return rate quietly eating their margins — fixing packaging and PDP copy alone added $340k in a single quarter, before we touched their media buying.",
      presenter_setback_story:
        "In year 2 we took on a client 3x bigger than anything we'd handled and nearly lost the account — and our reputation — because we didn't have the systems to manage that scale yet. We had to rebuild our entire onboarding and reporting process from scratch under pressure, but it's the reason we can handle 7-figure brands confidently today.",
      presenter_income_goal_6mo: "$180k/month agency revenue",
      presenter_income_goal_12mo: "$350k/month, launching a productized audit-only tier",
      presenter_mission_why:
        "I've seen too many founders quietly give up on brands that were one fixed lever away from working. I don't want another founder to shut down over a problem that was actually solvable in 90 days.",
      presenter_recognition:
        "Speaker at Growth Marketing Summit 2023 and 2024; featured case study in a leading ecom newsletter.",
      presenter_relatable_detail:
        "I coach my daughter's U10 soccer team on Saturday mornings and I am, by all accounts, far too intense about it for a recreational league.",
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
      offer_name: "The Inner Circle Mastermind",
      audience:
        "Founders and 7-figure operators who have hit a ceiling and need peers + strategic guidance, not tactics.",
      existing_assets:
        "34 current/past members as a referral base; podcast with 40k monthly downloads; email list of 9,000 founders; strong personal brand on LinkedIn.",
      awareness_level: "Most Aware",
      pain_points:
        "Hit 7 figures and suddenly has no peer group who understands the problems at this level. Every decision feels like it's made alone. Existing coaching feels like it's for an earlier stage of business. Reactive instead of strategic because there's no space carved out to think.",
      false_beliefs: "\"I don't have time for another program.\"",
      desired_transformation:
        "From lonely at the top and reactive, to surrounded by peers, focused on the 3 moves that matter.",
      category: "Executive mastermind",
      enemy:
        "The 'grind harder' founder culture that treats isolation at the top as inevitable instead of a problem worth solving.",
      differentiator:
        "Unlike mastermind groups that are really just paid networking, The Inner Circle pairs quarterly in-person intensives with weekly hot-seat access — real accountability and real access, not a Slack channel and a quarterly Zoom.",
      competitive_alternatives:
        "A $997/year mastermind that's mostly networking; an executive coach with no peer component; doing nothing and staying isolated; a board of advisors who aren't actually peers at this stage.",
      unique_mechanism:
        "Quarterly in-person intensives + weekly 90-minute hot-seat calls + private direct access.",
      core_promise: "Add $1M+ in the next 12 months without adding a single hour to your calendar.",
      outcomes:
        "- A peer group operating at the same level, finally\n- Average $2.1M added in year 1\n- Weekly access to strategic guidance on the 3 moves that matter\n- Clarity on which opportunities to say no to\n- A room that will tell you the truth, not just cheer you on",
      proof:
        "34 members; average member added $2.1M in year 1; 3 have exited for 8 figures. Video testimonials on file.",
      price: "$25,000/year (application required)",
      guarantee: "First 60 days: full refund if the intensives don't meet the promise. No questions.",
      bonuses:
        "- Private direct access to the founder between intensives — priceless, capped at 34 members\n- Curated intros within the existing member network\n- Annual capstone retreat with spouses/partners invited",
      scarcity_urgency:
        "Capped at 40 total members to protect hot-seat time; currently 34 filled, application-only, next cohort opens twice a year.",
      cta: "Apply for The Inner Circle",
      discovery_notes:
        "This is a relationship sale — application call is the actual conversion mechanism, not the webinar itself. Webinar's job is just to get the application started.",
    },
    presenterBio: {
      presenter_mission:
        "I help 7-figure founders who've hit a ceiling find the peer group and strategic clarity that got them here in the first place.",
      presenter_years_experience: "14 years (built and exited one company, has run masterminds for the last 6)",
      presenter_credentials:
        "No coaching certifications — credibility here is the track record: built a company to an 8-figure exit in 2017.",
      presenter_origin_story:
        "After my exit, I had more money than I'd ever had and felt more alone than ever — every peer I could talk to either hadn't been where I was or was a competitor. I built the room I wished existed for myself first, and it became The Inner Circle two years later.",
      presenter_signature_win:
        "A founder joined stuck at $3M in revenue for two straight years, convinced he'd hit his ceiling. Eighteen months in the room later, he'd restructured his leadership team, added $2.4M in annual revenue, and told me it was the first year running his company didn't feel lonely.",
      presenter_setback_story:
        "The first version of this mastermind was 80 members and felt like a networking event, not a real room — members stopped renewing because nobody actually knew each other. I cut it down to 40 max and rebuilt around real intimacy, and renewal rates went from 60% to 94%.",
      presenter_income_goal_6mo: "$850k/quarter across the membership",
      presenter_income_goal_12mo:
        "$4M/year, with a second cohort tier launched for founders at the $500k-$1M stage",
      presenter_mission_why:
        "The year after my exit was the loneliest of my life despite being the most 'successful.' I don't want anyone else to hit that ceiling and think isolation is just the cost of getting here.",
      presenter_recognition:
        "Featured in a Forbes founder profile; frequent guest on top business podcasts discussing the exit and rebuild.",
      presenter_relatable_detail:
        "I still drive the same 12-year-old truck I had before the exit — my wife says it's the one thing about me that hasn't changed.",
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
      offer_name: "Nightshift: Fall Asleep 3x Faster",
      audience: "Adults 30-55 who struggle to fall asleep because of racing thoughts, night sweats, or neck pain.",
      existing_assets:
        "List of 24,000 past customers from other sleep products; Instagram 45k followers; national TV founder feature; 3,000+ 5-star reviews on the flagship product line.",
      awareness_level: "Product-Aware",
      pain_points:
        "Lies awake for 45+ minutes most nights with a racing mind. Wakes up with neck pain that colors the whole day. Has already tried 2-3 pillows and given up on them helping. Feels like poor sleep is just 'how it is' at this stage of life.",
      false_beliefs: "\"I've bought expensive pillows before and they didn't help.\"",
      desired_transformation: "From tossing for 45 minutes every night to falling asleep in under 10.",
      category: "DTC sleep products",
      enemy:
        "The idea that any memory foam pillow is basically the same as any other — most just chase softness and ignore temperature and neck alignment entirely.",
      differentiator:
        "Unlike memory foam pillows that trap heat and make racing minds worse, the dual-layer graphene cooling core plus cervical contouring was developed specifically with a sleep neurologist for the racing-mind-plus-neck-pain combination, not comfort alone.",
      competitive_alternatives:
        "A $30 big-box store pillow (cheap, doesn't address the actual problem); a $400 luxury pillow with no clinical backing; melatonin/sleep aids (masks the problem, doesn't fix posture or heat); doing nothing and accepting bad sleep as normal.",
      unique_mechanism:
        "Dual-layer graphene cooling core + contoured cervical support, developed with a sleep neurologist.",
      core_promise:
        "Fall asleep 3x faster and wake up without neck pain — clinically-tested cooling memory foam.",
      outcomes:
        "- Fall asleep in under 10 minutes instead of 45+\n- Wake up without neck pain\n- Clinically-observed 78% faster sleep onset\n- No more overheating through the night\n- Confidence backed by a real 6-month study, not marketing claims",
      proof:
        "6-month clinical study with 128 participants: 78% reported faster sleep onset. Founder story featured on national TV.",
      price: "$149 (launch price $119 for the first 500 customers)",
      guarantee: "100-night trial, free returns, no questions.",
      bonuses:
        "- Free cooling pillowcase with launch orders — $29 value\n- Sleep Reset guide (email course) — $47 value\n- Extended 100-night trial instead of the standard 30",
      scarcity_urgency:
        "Launch price of $119 (vs. $149 regular) locked for the first 500 units only, then reverts to full price.",
      cta: "Claim your launch price — $119",
      discovery_notes:
        "Buyers have pillow fatigue from past purchases — lead with the clinical study and neurologist involvement before anything about comfort/feel.",
    },
    presenterBio: {
      presenter_mission:
        "I help people who've given up on good sleep actually fall asleep faster and wake up without pain — not with another vague 'wellness' product, with something clinically tested.",
      presenter_years_experience: "8 years running the brand",
      presenter_credentials:
        "No personal medical credentials — the product was co-developed with a board-certified sleep neurologist, named in the clinical study.",
      presenter_origin_story:
        "I spent three years trying every pillow on the market for my own racing-mind insomnia and neck pain, and nothing worked because they were all solving for softness, not the actual mechanism. I partnered with a sleep neurologist to build the pillow I actually needed.",
      presenter_signature_win:
        "A customer wrote in after 15 years of chronic neck pain and said Nightshift was the first pillow that let her sleep through a full night without waking up to reposition — she'd tried 11 other pillows first.",
      presenter_setback_story:
        "Our first product run had a manufacturing defect that caused the cooling layer to break down after 2 months, and we ate the cost of replacing every unit sold that quarter — nearly $80k we didn't have. It was terrifying, but it's why our current QA process tests every batch three separate times before it ships.",
      presenter_income_goal_6mo: "$400k/month in revenue",
      presenter_income_goal_12mo: "$900k/month, expanding into a full sleep system (pillow + mattress topper)",
      presenter_mission_why:
        "My own sleep problems went undiagnosed and dismissed for years because 'just buy a better pillow' isn't real medical advice. I wanted to build something backed by an actual clinician, not just marketing.",
      presenter_recognition:
        "Featured on a national morning TV segment on sleep products; covered in a wellness industry trade publication.",
      presenter_relatable_detail:
        "I'm a genuinely terrible sleeper myself even with the product — my wife jokes that I'm the brand's most stubborn customer.",
    },
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
