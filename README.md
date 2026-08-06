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
- **AI:** Anthropic Claude API
- **Billing:** Stripe (12-month membership subscription + one-off credit top-ups)
- **Export:** jsPDF / docx for PDF and Word export

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the migrations in order: `supabase/migrations/0001_init.sql`, then
   `supabase/migrations/0002_presentation_analysis.sql`. Together they create:
   - `profiles` — one row per user, with the 12-month access window and credit meter
   - `projects` — one per offer, with discovery fields
   - `generations` — every generation/analysis + full token/cost telemetry (`asset_type`
     includes `presentation_analysis`; `input_content` holds pasted analyzer input)
   - `admin_settings` — the global kill switch + daily spend cap (singleton row)
   - `credit_topups` — Stripe top-up purchase history
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
given video/audio; since this app only accepts pasted text, the user-message wrapper tells
the model explicitly that no video/audio was provided so it doesn't fabricate delivery
critique (voice, eye contact, lighting, etc.) — see the comment in that file before editing.
Video upload + frame/audio analysis isn't implemented.

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
7. ✅ Presentation Analyzer (19-point conversion-readiness critique)
