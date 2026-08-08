# Pitch Perfect AI

A metered SaaS that wraps the Pitch Perfect Method™ (Discovery → Positioning → Presentation)
in accounts, credit metering, and billing, so members get 12 months of access to generate
webinars, VSL scripts, sales pages, landing pages, email sequences, and PPT outlines — plus
run any presentation through a 19-point conversion-readiness Analyzer — without a heavy
user bleeding the API budget.

Built per the Demo & Build Spec: MVP = auth + one metered generator, proven guardrails, then
expand. See `src/lib/ai/knowledge/README.md` for how the AI "brain" is organized.

## Stack

- **Frontend/Backend:** Next.js 16 (App Router, TypeScript, Tailwind)
- **Auth/DB:** Supabase (Postgres + built-in auth, Row Level Security)
- **AI:** Anthropic Claude API (text + vision), OpenAI Whisper (video transcription)
- **Billing:** Stripe (12-month membership subscription + one-off credit top-ups)
- **Export:** jsPDF / docx for PDF and Word export

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the migrations **in order**: `0001_init.sql`, then
   `0002_presentation_analysis.sql`, then `0003_redesign_features.sql`, then
   `0004_video_analysis.sql`, then `0005_full_discovery.sql`. Together they create:
   - `profiles` — one row per user, with the 12-month access window and credit meter
   - `projects` — one per offer, with the full Discovery → Customer Awareness → Positioning →
     Value Proposition → Offer intake (see "Project discovery" below)
   - `generations` — every generation/analysis + full token/cost telemetry (`asset_type`
     covers all generators plus `presentation_analysis` and `headline_lab`;
     `project_id` is nullable for `headline_lab`, the one tool that isn't project-scoped;
     `input_content` holds pasted analyzer input / headline brief)
   - `admin_settings` — the global kill switch + daily spend cap (singleton row)
   - `credit_topups` — Stripe top-up purchase history
   - `brand_voices` — one row per user (tone, preferred/forbidden words, writing sample,
     notes), folded into every generation's system prompt
   - `presentation-videos` Storage bucket (private, owner-only) + the `generations` columns
     the video analysis pipeline needs (`video_path`, `video_duration_seconds`, `transcript`,
     `progress_message`, `transcription_cost_usd`) and an expanded `status` enum for the
     staged upload → transcribe → extract frames → analyze flow
   - RLS policies, an `on_auth_user_created` trigger that provisions a `profiles` row on
     signup, and `updated_at` triggers.
3. Copy the Project URL, anon key, and service role key into `.env.local` (see
   `.env.example`).
4. To make yourself an admin (for `/admin`):
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
5. In Auth settings, set the Site URL / redirect URL to match `NEXT_PUBLIC_APP_URL` +
   `/auth/callback` (e.g. `http://localhost:3000/auth/callback` in dev).

## 2. Anthropic setup

Get an API key from [console.anthropic.com](https://console.anthropic.com) and set
`ANTHROPIC_API_KEY`. Double-check `ANTHROPIC_INPUT_COST_PER_MTOK` /
`ANTHROPIC_OUTPUT_COST_PER_MTOK` against current pricing before relying on the cost
telemetry for real budgeting decisions.

## 2b. OpenAI setup (for video analysis)

Agent Annie's video upload path transcribes audio with Whisper before analyzing it. Get an
API key from [platform.openai.com](https://platform.openai.com) and set `OPENAI_API_KEY`.
Double-check `WHISPER_COST_PER_MINUTE` against current pricing. If you don't set this, the
text-paste analyzer still works fine — only video uploads need it.

## 3. Stripe setup

1. Create a recurring **Price** with a **yearly** interval for the membership product —
   this is what renews the 12-month access window. Put its ID in
   `STRIPE_MEMBERSHIP_PRICE_ID`.
2. Credit top-up packs don't need pre-created Prices — they're built with
   `price_data` at checkout time from `CREDIT_TOPUP_PACKS` in `src/lib/stripe.ts`. Adjust
   pricing there to match your unit economics (see the comment in that file).
3. Add a webhook endpoint pointing at `/api/stripe/webhook`, subscribed to at least
   `checkout.session.completed` and `invoice.paid`. Put the signing secret in
   `STRIPE_WEBHOOK_SECRET`.
4. For local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## 4. Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values above
npm run dev
```

## 5. Deploy

Deploy to Vercel (or any Next.js host). Set the same environment variables in your hosting
provider's dashboard, and point the Stripe webhook and Supabase redirect URL at your
production domain.

**Video analysis needs a plan that allows longer function execution.** The video pipeline
(`/api/analyze/video/process`, `maxDuration = 300`) transcribes and analyzes a full webinar in
the background via `after()`, which can take several minutes for a 60-90 minute video. Vercel's
free/Hobby tier caps functions at 60s regardless of `maxDuration`, so that route will be cut off
mid-pipeline and leave the generation stuck instead of marked "failed". Vercel Pro (or
self-hosting) is required for this feature to actually finish; the text-paste analyzer and every
other generator are unaffected either way.

## Project discovery

Every project's intake (`src/app/(app)/projects/[id]/DiscoveryForm.tsx`, saved via
`updateProjectDiscovery` in `src/lib/actions/projects.ts`) matches the fuller Discovery →
Customer Awareness → Positioning → Value Proposition → Offer brief from the Lovable prototype's
wizard, not just a handful of fields — this is what a real VSL/webinar/sales page needs, not a
short summary:

- **Discovery** — business/brand name, industry/niche, product or service, target audience,
  existing marketing assets
- **Customer Awareness** — awareness level (Unaware → Most Aware), biggest pain points, false
  beliefs/objections, desired transformation
- **Positioning** — market category, the enemy/villain, primary differentiator, competitive
  alternatives
- **Value Proposition** — unique mechanism, core promise, top outcomes/benefits, proof available
- **Offer** — price point, guarantee, bonuses, scarcity/urgency, primary call to action

`formatDiscoveryBlock` (`src/lib/ai/generators/shared.ts`) renders the whole brief, grouped the
same way, into every generator's and Agent Annie's system prompt — this is the single place
"discovery-before-copy" is enforced, so no generator sees a different or partial brief. Migration
`0005_full_discovery.sql` added these columns without dropping the earlier flat fields
(`who_its_for`, `the_problem`, etc.) — existing project data was backfilled into the closest new
field, and the old columns are simply unused by the app now.

## The guardrails (margin protection)

All server-side, per the build spec — see `src/lib/credits.ts`:

- **Kill switch** — an admin can instantly pause all generations (`/admin`).
- **Daily global spend cap** — blocks all generation once today's total cost hits the cap.
- **Per-user credit balance + monthly allotment** — checked and decremented server-side on
  every call; the browser is never trusted for limits.
- **Rate limiting** — max N generations per minute/hour per user (`RATE_LIMIT_PER_MINUTE` /
  `RATE_LIMIT_PER_HOUR`).
- **Output token caps** — every asset type has a `maxOutputTokens` ceiling
  (`src/lib/ai/generators/index.ts`, `ANALYZER_MAX_OUTPUT_TOKENS` for the analyzer), so no
  single call can run away. Analyzer input is also capped (`ANALYZER_MAX_INPUT_CHARS`).
- **Cost telemetry** — every generation logs input/output tokens and estimated cost
  (`generations` table), visible per-member on `/admin`.
- **12-month access window** — enforced before any generation runs, independent of credits.

Before launch, work through the spec's math: (cost per generation) × (expected
generations/member/month) × (member count) should stay comfortably under what your
membership price + the daily cap can absorb.

## Presentation Analyzer

`/projects/[id]/analyze` (API: `/api/analyze`) runs a pasted webinar/VSL/sales-presentation/
investor-pitch script through a 19-point conversion-readiness rubric (structure, hook,
credibility, offer quality, objection handling, ethics/factual-accuracy flags, scored
readiness, missing components, prioritized fixes) and returns a structured critique. It's not
a generator — the input is pasted text, not a project's discovery fields — but it runs through
the same guardrail pipeline (credits, rate limits, kill switch, cost telemetry) as everything
else, via `checkGuardrails`/`generateAsset` in `src/app/api/analyze/route.ts`.

The system prompt (`ANALYZER_SYSTEM_PROMPT` in `src/lib/ai/analyzer.ts`) assumes it may be
given video/audio. For the text-paste path, the user-message wrapper tells the model
explicitly that no video/audio was provided so it doesn't fabricate delivery critique (voice,
eye contact, lighting, etc.) — see the comment in that file before editing.

### Video upload

The same page also accepts a full video upload (up to 90 minutes / 500MB) for real delivery
review — voice, pacing, energy, camera framing, lighting — on top of the full rubric, at
`VIDEO_ANALYZER_CREDIT_COST` (20) credits instead of 8. It's a staged async pipeline, not a
single request/response, because a 90-minute video can't be transcribed and analyzed inside
one HTTP call:

1. `POST /api/analyze/video/start` reserves a `generations` row and returns a Storage path.
2. The browser uploads the file **directly to Supabase Storage** (`presentation-videos`
   bucket, RLS-scoped to the user's own folder) — never through a Next.js route, so it isn't
   bound by serverless request body limits.
3. `POST /api/analyze/video/process` validates the upload, marks the generation `uploaded`,
   and hands off to `runVideoAnalysisPipeline` (`src/lib/video/pipeline.ts`) via Next.js
   `after()`, responding immediately.
4. In the background, the pipeline downloads the video, extracts + chunks audio
   (`src/lib/video/ffmpeg.ts`), transcribes each chunk in parallel with OpenAI Whisper
   (`src/lib/video/transcription.ts`), samples ~8 frames across the runtime for Claude's
   vision input, then runs the same rubric through `generateAsset()` — now vision-capable
   (`images` param) — via `getAnalyzerSystemPrompt()` + `buildVideoAnalyzerUserPrompt()`
   (`src/lib/ai/videoAnalyzer.ts`). Status moves through `uploaded` → `transcribing` →
   `extracting_frames` → `analyzing` → `complete`/`failed` on the `generations` row at each
   stage.
5. The browser polls that row directly via the Supabase client (`AnalyzeClient.tsx`) — no
   separate status API — and renders the same result view as the text path once `complete`.
6. Credits are only decremented on success, same as every other guardrailed call; a failure
   at any stage marks the row `failed` with an error and charges nothing.

Claude's API has no native video input, so "video analysis" here means transcript + sampled
still frames, not continuous video/audio — the video prompt says so explicitly and asks the
model not to claim it saw things (like specific gestures) that stills can't show. See
"Deploy" above for the hosting requirement this feature has (longer function execution).

## Design system

Redesigned to match a design produced in Lovable (repo: `pitch-perfect-pal-36`) — dark
navy/royal-blue/silver theme (Sora display font + Inter body, `src/app/globals.css`), a
collapsible sidebar app shell (`src/components/AppSidebar.tsx`, `src/app/(app)/layout.tsx`)
replacing the old top-nav for authenticated pages, and shadcn/ui primitives in
`src/components/ui/` (ported from that repo's generated components, not hand-written — see
the comment at the top of `src/types/database.ts`-adjacent files for the pattern if you add
more). Public pages (`/`, `/login`, `/signup`) keep a lighter marketing header via
`src/app/(marketing)/layout.tsx`.

The redesign deliberately did **not** carry over Lovable's backend — that version had no
credit limits, rate limiting, kill switch, or cost telemetry. Every new feature below still
goes through this app's existing guardrail pipeline.

## New tools (ported from the Lovable design pass)

- **Ad Copy** and **Offer Ladder** — two more discovery-driven generators, same pattern as
  the original six (`src/lib/ai/generators/adCopy.ts`, `offerLadder.ts`).
- **Brand Voice** (`/brand-voice`) — save a tone description, preferred/forbidden words, a
  writing sample, and notes once; every generator and Headline Lab call folds it into the
  system prompt automatically (`src/lib/ai/brandVoice.ts`). The Presentation Analyzer
  deliberately skips it — it critiques someone else's copy, not the user's own.
- **Headline Lab** (`/headline-lab`, API: `/api/headlines`) — generates 20 headlines rated
  1-10 with reasoning from a topic/audience/promise brief; not project-scoped, but still
  metered through the same `checkGuardrails`/`generateAsset` pipeline. Winner-picking is
  client-side only for now (not persisted) — see "Not yet done" below.

## AI Agent system

Every generator and the analyzer is fronted by a named specialist agent, so the app feels
like an AI marketing team rather than a grid of buttons — Agent Sarah (Webinar), Agent
Vicky (VSL), Agent Sally (Sales Page), Agent Paige (Landing Page), Agent Ellie (Emails),
Agent Polly (PPT), Agent Addie (Ad Copy), Agent Olivia (Offer Ladder), and Agent Annie
(Presentation Analyzer). This is a branding + persona layer, **not** a parallel system:

- `src/lib/agents/config.ts` is the single source of truth — name, title, emoji, tagline,
  description, and `personaInstructions` per agent, keyed 1:1 to the existing asset types.
  Add a 10th agent by adding one entry here (plus a generator, if it's a new capability) —
  never a parallel prompt/route/UI system.
- Each agent's `personaInstructions` folds into the *same* system prompt call its asset type
  already used — `buildSystemPrompt(mode, brandVoiceBlock, agentPersona)` in
  `src/app/api/generate/route.ts` for the eight generators, and a thin
  `getAnalyzerSystemPrompt()` wrapper in `src/lib/ai/analyzer.ts` that prepends Annie's
  identity in front of the verbatim analyzer rubric (that rubric text itself is untouched —
  see the comment above it).
- `src/components/AgentBadge.tsx` is the one place the emoji/name/title/tagline render —
  used on the project page's generator grid, each generate/analyze page header, and the
  landing page's team teaser. No page hand-rolls this markup itself.
- `headline_lab` intentionally has no agent (wasn't part of the requested roster).
- Per-generator-type "upload and analyze" isn't duplicated eight times — Agent Annie's
  existing Presentation Analyzer already covers webinar/VSL/sales-presentation/pitch-deck
  analysis generically, so that's the one place "analyze what I built" lives for every
  asset type, including the video upload path (see "Video upload" above).

## Not yet done

Deferred from the Lovable feature set to avoid shipping anything half-finished: rich-text
editing of generated content (currently plain text), persisted version history per
generation, autosave, an onboarding tour, the sample-project dialog, and TTS playback. None
of these affect the guardrails or core generation pipeline — they're pure UX additions for a
future pass.

## Knowledge base

Nine Pitch Perfect AI playbooks are currently encoded into `src/lib/ai/knowledge/`: The
Philosophy, PPOS, Discovery, Customer Awareness, Value Proposition, Offer Creation,
Campaign Architecture (PPCOS), the Webinar Manual (PPWOS), the Sales Presentation
Playbook (PPSOS), and the VSL Manual's real 25-stage structure. See
`src/lib/ai/knowledge/README.md` for what's loaded where, what's still missing (a dedicated
sales-page/landing-page and email-sequence playbook), and how to fold in more as they're
provided.

## Build order (matches the spec)

1. ✅ Auth + accounts + 12-month access window
2. ✅ One generator end-to-end (webinar outline) with credit meter + hard cap
3. ✅ The rest of the generators (VSL, sales page, landing page, emails, PPT)
4. ✅ Save/export (copy, PDF, .docx)
5. ✅ Stripe billing + credit top-ups
6. ✅ Admin: cost telemetry dashboard + global kill switch
7. ✅ Presentation Analyzer (19-point conversion-readiness critique, text + full video upload)
