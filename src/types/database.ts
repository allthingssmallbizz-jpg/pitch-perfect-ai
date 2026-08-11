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
  | "social_compare";

export type PresentationType =
  | "webinar"
  | "vsl"
  | "sales_presentation"
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
  created_at: string;
  updated_at: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
