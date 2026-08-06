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
  | "presentation_analysis";

export type PresentationType = "webinar" | "vsl" | "sales_presentation" | "investor_pitch" | "other";

export type GenerationMode = "coach" | "expert";
export type GenerationStatus = "pending" | "complete" | "failed";
export type UserRole = "member" | "admin";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
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

export type Project = {
  id: string;
  user_id: string;
  name: string;
  who_its_for: string;
  the_problem: string;
  the_transformation: string;
  price: string;
  bonuses: string;
  guarantee: string;
  proof: string;
  one_result: string;
  discovery_notes: string;
  mode: GenerationMode;
  created_at: string;
  updated_at: string;
};

export type Generation = {
  id: string;
  user_id: string;
  project_id: string;
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
  cost_usd: number;
  credits_charged: number;
  error: string | null;
  created_at: string;
};

export type AdminSettings = {
  id: true;
  daily_spend_cap_usd: number;
  kill_switch_enabled: boolean;
  kill_switch_reason: string | null;
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
      admin_settings: Table<AdminSettings>;
      credit_topups: Table<CreditTopup>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
