// Hand-written types mirroring supabase/migrations/0001_init.sql.
// If you use the Supabase CLI, you can replace this with `supabase gen types typescript`.
//
// NOTE: these must be `type` aliases, not `interface`s. Supabase's generic constraints
// (GenericTable/GenericSchema) check `X extends Record<string, unknown>`, and TypeScript
// interfaces — unlike type aliases — don't satisfy that structural check, which silently
// collapses every query's inferred Row type to `never`.

export type AssetType =
  | "webinar_outline"
  | "vsl_script"
  | "sales_page"
  | "landing_page"
  | "email_sequence"
  | "ppt_outline"
  | "presentation_analysis"
  | "ad_copy"
  | "offer_ladder"
  | "headline_lab"
  | "tts_narration"
  | "discovery_assist"
  | "ad_image"
  | "website_import"
  | "social_compare"
  | "offer_builder"
  | "brand_color_surprise"
  | "thank_you_page"
  | "challenge_outline";

export type PresentationType =
  | "webinar"
  | "sales_presentation"
  | "email"
  | "five_day_challenge"
  | "breakout_room"
  | "transcription"
  | "vsl"
  | "investor_pitch"
  | "youtube_video"
  | "instagram_reel"
  | "tiktok_video"
  | "other";

export type GenerationMode = "coach" | "expert";
export type GenerationStatus =
  | "pending"
  | "uploaded"
  | "transcribing"
  | "extracting_frames"
  | "analyzing"
  | "complete"
  | "failed";
export type UserRole = "member" | "admin";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  // Free-text label an admin assigns (e.g. "Member", "Pro", "Founding Member") — purely
  // descriptive, not tied to a Stripe product/price. Defaults to "Member".
  tier: string;
  access_started_at: string;
  access_expires_at: string;
  credits_balance: number;
  credits_monthly_allotment: number;
  credits_reset_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentType = "membership" | "topup";

export type Payment = {
  id: string;
  user_id: string;
  type: PaymentType;
  amount_usd: number;
  credits: number | null;
  stripe_checkout_session_id: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
};

export type AwarenessLevel =
  | ""
  | "Unaware"
  | "Problem-Aware"
  | "Solution-Aware"
  | "Product-Aware"
  | "Most Aware";

export type Project = {
  id: string;
  user_id: string;
  name: string;
  // Discovery
  business_name: string;
  industry: string;
  product: string;
  // The public-facing name of the webinar/challenge/program itself, distinct from `product`
  // (which describes what it is) and `name` (the project's own internal label). Optional —
  // drafted by the Offer Builder for anyone who doesn't have one yet.
  offer_name: string;
  audience: string;
  existing_assets: string;
  // Customer Awareness
  awareness_level: AwarenessLevel;
  pain_points: string;
  false_beliefs: string;
  desired_transformation: string;
  // Positioning
  category: string;
  enemy: string;
  differentiator: string;
  competitive_alternatives: string;
  // Value Proposition
  unique_mechanism: string;
  core_promise: string;
  outcomes: string;
  proof: string;
  // Offer
  price: string;
  guarantee: string;
  bonuses: string;
  scarcity_urgency: string;
  cta: string;
  // Which conversion pattern this offer's CTA actually leads to — drives the Thank You Page
  // generator's branching (see src/lib/funnelType.ts). Empty string means not yet chosen.
  funnel_type: string;
  discovery_notes: string;
  mode: GenerationMode;
  created_at: string;
  updated_at: string;
  // Soft-delete marker — null while active. "Delete project" sets this instead of removing the
  // row, so a project (and every generation in it) can be restored from the Dashboard's
  // "Recently deleted" list instead of a single click/misclick being unrecoverable.
  deleted_at: string | null;
};

export type Generation = {
  id: string;
  user_id: string;
  // Null for asset_type "headline_lab" — the only tool that isn't scoped to a project.
  project_id: string | null;
  asset_type: AssetType;
  mode: GenerationMode;
  status: GenerationStatus;
  content: string | null;
  // The pasted presentation script/transcript being analyzed — only set for
  // asset_type "presentation_analysis". Null for ordinary generators, whose input is
  // always reconstructable from the project's discovery fields.
  input_content: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  // Total cost for this generation. For video analysis this includes transcription_cost_usd.
  cost_usd: number;
  credits_charged: number;
  error: string | null;
  created_at: string;
  // Video analysis pipeline (Agent Annie's video upload path) — null for everything else.
  video_path: string | null;
  video_duration_seconds: number | null;
  video_size_bytes: number | null;
  transcript: string | null;
  progress_message: string | null;
  transcription_cost_usd: number;
  // Headline Lab's winner picks (the headline strings) — only meaningful for
  // asset_type "headline_lab". Empty array for everything else.
  winners: string[];
  // Agent Addie's Image Ads pipeline (asset_type "ad_image") — null for everything else.
  // `content` holds the generated copy as JSON: {"headline","subheadline","cta"}.
  image_source_path: string | null;
  image_result_path: string | null;
  // Publishing (Landing Page / Thank You Page only) — see src/lib/publishing.ts and
  // src/app/site/[slug]/route.ts. publish_slug persists across unpublish/republish so a shared
  // link never silently changes; published_at null means "not currently live."
  publish_slug: string | null;
  published_at: string | null;
};

export type GenerationVersionSource = "generate" | "edit" | "snapshot";

export type GenerationVersion = {
  id: string;
  generation_id: string;
  user_id: string;
  content: string;
  source: GenerationVersionSource;
  label: string | null;
  created_at: string;
};

export type AdminSettings = {
  id: true;
  daily_spend_cap_usd: number;
  kill_switch_enabled: boolean;
  kill_switch_reason: string | null;
  // Optional YouTube/Vimeo URL for the "how to fill this out" walkthrough video shown at the
  // top of every project's Discovery form. Null hides that section entirely.
  discovery_video_url: string | null;
  updated_at: string;
};

export type CreditTopup = {
  id: string;
  user_id: string;
  credits: number;
  amount_usd: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
};

export type BrandVoice = {
  user_id: string;
  tone: string;
  forbidden_words: string;
  preferred_words: string;
  sample_writing: string;
  extra_notes: string;
  // Hex color strings (e.g. "#3366ff"), or "" if unset — a 4-color palette used by visual
  // generators (currently Landing Page) instead of picking colors on their own. The generator
  // decides which color goes where (buttons, backgrounds, borders, small accents) — these aren't
  // fixed roles, just the available palette.
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  outline_color: string;
  created_at: string;
  updated_at: string;
};

// One row per user (same pattern as BrandVoice above) — filled in once on its own /bio page,
// folded into every generation's system prompt automatically (see getPresenterBioBlock in
// src/lib/ai/presenterBio.ts) instead of living on each project's Discovery form. Feeds the
// Credibility Bridge and Opening Story beats (VSL stages 5-6, webinar Phase 1/2) that "Proof"
// alone can't cover, since that field is about the OFFER's evidence, not who's presenting it.
export type PresenterBio = {
  user_id: string;
  presenter_mission: string;
  presenter_years_experience: string;
  presenter_credentials: string;
  presenter_origin_story: string;
  presenter_signature_win: string;
  presenter_setback_story: string;
  presenter_income_goal_6mo: string;
  presenter_income_goal_12mo: string;
  presenter_mission_why: string;
  presenter_recognition: string;
  presenter_relatable_detail: string;
  created_at: string;
  updated_at: string;
};

// One row per user — a Go High Level Private Integration token + Location ID, pasted in from
// their own GHL sub-account (Settings > Private Integrations). See src/lib/integrations/ghl.ts.
// Empty strings mean "not connected yet," same convention as BrandVoice's optional fields.
export type GhlConnection = {
  user_id: string;
  location_id: string;
  api_token: string;
  created_at: string;
  updated_at: string;
};

// One row per form submission from a published Landing Page — written regardless of whether the
// GHL sync succeeds, so a lead is never silently lost to a CRM API hiccup or to GHL not being
// connected yet. See src/app/api/forms/submit/[generationId]/route.ts.
export type FormLead = {
  id: string;
  user_id: string;
  project_id: string | null;
  generation_id: string | null;
  name: string;
  email: string;
  phone: string;
  ghl_synced: boolean;
  ghl_error: string | null;
  created_at: string;
};

// One row per page load on a published page (see src/app/site/[slug]/route.ts) — paired with
// FormLead above to compute views / leads / conversion % per page. No dedup by visitor; a raw
// pageview count, same "basic analytics" scope as the rest of this feature.
export type PageView = {
  id: string;
  user_id: string;
  generation_id: string;
  created_at: string;
};

// Minimal Database type shape for @supabase/ssr / @supabase/supabase-js generics.
// Matches the GenericSchema/GenericTable shape those packages expect (Row/Insert/Update/
// Relationships, plus Views/Functions on the schema) — see
// node_modules/@supabase/postgrest-js/src/types/common/common.ts.
type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      projects: Table<Project>;
      generations: Table<Generation>;
      generation_versions: Table<GenerationVersion>;
      admin_settings: Table<AdminSettings>;
      credit_topups: Table<CreditTopup>;
      payments: Table<Payment>;
      brand_voices: Table<BrandVoice>;
      presenter_bios: Table<PresenterBio>;
      ghl_connections: Table<GhlConnection>;
      form_leads: Table<FormLead>;
      page_views: Table<PageView>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
