import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tier } from "@/types/database";

// One row per NICHE (a project picks exactly one via its presenter_bio_profile_id — see
// PresenterBioProfile in src/types/database.ts), filled in on /bio/[profileId] — folded into
// every generation's system prompt the same way getBrandVoiceBlock is, so a member never
// re-answers "how did you get into this industry" per project. Feeds the Credibility Bridge and
// Opening Story beats specifically, but is available to every generator. `profileId` is nullable
// only defensively — every project should have one post-migration (0031_niche_bio_profiles.sql).
export async function getPresenterBioBlock(
  supabase: SupabaseClient<Database>,
  profileId: string | null
): Promise<string | null> {
  if (!profileId) return null;
  const { data } = await supabase.from("presenter_bio_profiles").select("*").eq("id", profileId).maybeSingle();
  if (!data || isPresenterBioEmpty(data)) return null;

  const field = (label: string, value: string) => (value.trim() ? `${label}: ${value.trim()}` : null);
  // The AI-crafted, member-picked statement (see the "I Help Statement" builder on /bio) takes
  // priority — it's sharper than a mechanical join and may not even decompose cleanly back into
  // the three raw parts (e.g. it might restructure the sentence entirely). Only falls back to the
  // naive join when the member has filled in the raw parts but never actually run the generator.
  const ihelp =
    data.presenter_ihelp_statement.trim() ||
    composeIHelpStatement(data.presenter_ihelp_audience, data.presenter_ihelp_outcome, data.presenter_ihelp_mechanism);

  const lines = [
    "PRESENTER BIO — the person behind the offer, not the offer itself. Use for Credibility Bridge / Opening Story / any presenter-intro beat:",
    ihelp
      ? `Their "I Help" positioning statement — reuse this exact audience/outcome/mechanism framing across hooks, headlines, and intros instead of inventing a different one each time: "${ihelp}"`
      : null,
    field("What they help people do", data.presenter_mission),
    field("Years in this industry", data.presenter_years_experience),
    field("Credentials, certifications, or degrees", data.presenter_credentials),
    field("How they got into this industry", data.presenter_origin_story),
    field("Greatest client transformation", data.presenter_signature_win),
    field("A major setback and how they turned it around", data.presenter_setback_story),
    field("Personal 'why'", data.presenter_mission_why),
    field("Media, speaking, or industry recognition", data.presenter_recognition),
    field("A relatable, human detail", data.presenter_relatable_detail),
    field("Income goal — next 6 months", data.presenter_income_goal_6mo),
    field("Income goal — next 12 months", data.presenter_income_goal_12mo),
  ].filter((line): line is string => line !== null);

  if (data.presenter_income_goal_6mo.trim() || data.presenter_income_goal_12mo.trim()) {
    lines.push(
      "(Income goals are personal context for vision-casting/authenticity, not a line to quote verbatim in customer-facing copy — use judgment on whether an asset benefits from it at all.)"
    );
  }

  return lines.join("\n");
}

// Composed on read from its three parts rather than stored — see the migration's comment for why
// (keeps the sentence from ever drifting out of sync with the parts it's built from). Returns ""
// until all three parts are filled in, since a partial "I help ___ with ___" reads worse than
// nothing at all.
export function composeIHelpStatement(audience: string, outcome: string, mechanism: string): string {
  const a = audience.trim();
  const o = outcome.trim();
  const m = mechanism.trim();
  if (!a || !o || !m) return "";
  return `I help ${a} ${o} with ${m}.`;
}

type PresenterBioFields = {
  presenter_ihelp_audience: string;
  presenter_ihelp_outcome: string;
  presenter_ihelp_mechanism: string;
  presenter_ihelp_pain_point: string;
  presenter_ihelp_statement: string;
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
};

// True when every field is blank (or no row exists yet) — used only to decide whether there's
// anything at all worth folding into the system prompt above. Deliberately NOT used for the "can
// this member reach an agent" gate below — a bio with one field filled in isn't empty, but it's
// still nowhere near strong enough to write a real Credibility Bridge / Opening Story, so the gate
// needs its own, stricter definition of "done." See isPresenterBioIncomplete.
export function isPresenterBioEmpty(bio: PresenterBioFields | null | undefined): boolean {
  if (!bio) return true;
  return Object.values(bio).every((v) => !v.trim());
}

// The fields PresenterBioForm.tsx marks with a required red asterisk — the single source of
// truth for "is this bio actually strong enough to generate from," shared by the form's own
// post-save feedback (updatePresenterBio) and the hard gate blocking every agent
// (isPresenterBioIncomplete) so neither can drift out of sync with what the UI actually asks for.
// Credentials/certifications and Media/speaking/industry recognition are the two Aaron said are
// fine to skip — real answers even when genuinely blank ("none yet"), not a sign the bio was
// rushed. The whole "I Help" statement section (the audience/outcome/mechanism builder, the
// "biggest struggle" field, and the crafted statement box) is also deliberately NOT required —
// it's a generator that helps someone find the words for "What do you help people do?" below, not
// a second, separate answer to require on top of it. That one field (presenter_mission) is the
// real required answer; its own hint nudges toward phrasing it with the I Help framework, but
// nobody gets blocked just for not having run the generator.
export const REQUIRED_BIO_FIELDS: { key: keyof PresenterBioFields; label: string }[] = [
  { key: "presenter_mission", label: "What do you help people do?" },
  { key: "presenter_years_experience", label: "Years in this industry" },
  { key: "presenter_origin_story", label: "How did you get into this industry?" },
  { key: "presenter_signature_win", label: "Your greatest client transformation" },
  { key: "presenter_setback_story", label: "Your major setback — and how you turned it around" },
  { key: "presenter_mission_why", label: "Your personal 'why'" },
  { key: "presenter_relatable_detail", label: "A relatable, human detail about you" },
  { key: "presenter_income_goal_6mo", label: "Income goal — next 6 months" },
  { key: "presenter_income_goal_12mo", label: "Income goal — next 12 months" },
];

type RequiredBioFieldKey = (typeof REQUIRED_BIO_FIELDS)[number]["key"];

// Works against either the typed DB row (layout.tsx, the generate/ad-image/agent-landing gates,
// the API routes) or the raw string fields extracted from formData in updatePresenterBio — both
// shapes have every required key as a string, which is all a Partial<Record<...>> needs.
export function getMissingBioFieldLabels(
  bio: Partial<Record<RequiredBioFieldKey, string>> | null | undefined
): string[] {
  if (!bio) return REQUIRED_BIO_FIELDS.map((f) => f.label);
  return REQUIRED_BIO_FIELDS.filter(({ key }) => !String(bio[key] ?? "").trim()).map((f) => f.label);
}

// The real "can this member reach an agent" check — every required field filled in, not just
// "not literally nothing" (see isPresenterBioEmpty above for that weaker check).
export function isPresenterBioIncomplete(bio: Partial<Record<RequiredBioFieldKey, string>> | null | undefined): boolean {
  return getMissingBioFieldLabels(bio).length > 0;
}

// How many niche bio profiles each membership tier can create — the first real tier-gated
// feature in the app (profiles.tier used to be a purely cosmetic admin label; see the Tier type
// and 0031_niche_bio_profiles.sql). Founding Member gets the same unlimited allowance as
// Platinum — it's a legacy/loyalty label, not a lesser tier. The Infinity values are deliberate,
// not placeholders — they're never shown as a real remaining-count, only used in the `>=` check
// in canCreateBioProfile below (and Infinity + a finite bonus_niche_limit is still Infinity).
export const TIER_NICHE_LIMITS: Record<Tier, number> = {
  Gold: 1,
  Silver: 3,
  Platinum: Infinity,
  "Founding Member": Infinity,
};

export type PresenterBioProfileSummary = {
  id: string;
  label: string;
  incomplete: boolean;
};

// Every niche on this account, for the /bio list page and the project-creation picker — cheapest
// possible shape (not every presenter_* column) since neither caller needs the full bio text.
export async function getPresenterBioProfiles(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PresenterBioProfileSummary[]> {
  const { data } = await supabase
    .from("presenter_bio_profiles")
    .select(
      "id, label, presenter_mission, presenter_years_experience, presenter_origin_story, presenter_signature_win, presenter_setback_story, presenter_mission_why, presenter_relatable_detail, presenter_income_goal_6mo, presenter_income_goal_12mo"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    incomplete: isPresenterBioIncomplete(row),
  }));
}

// The tier-limit check for "+ New niche" — same {ok, message} shape checkGuardrails
// (src/lib/credits.ts) already uses for guardrail results, though this is the first limit keyed
// off tier rather than credits/rate/kill-switch, so there's no shared helper to actually reuse.
// bonusNicheLimit is the admin-granted extra allowance on top of the tier baseline (see
// Profile.bonus_niche_limit) — always additive, never a replacement for the tier's own limit.
export async function canCreateBioProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  tier: Tier,
  bonusNicheLimit = 0
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { count } = await supabase
    .from("presenter_bio_profiles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const limit = TIER_NICHE_LIMITS[tier] + bonusNicheLimit;
  if ((count ?? 0) >= limit) {
    const nextTier: Partial<Record<Tier, Tier>> = { Gold: "Silver", Silver: "Platinum" };
    const upgradeHint = nextTier[tier]
      ? ` Upgrade to ${nextTier[tier]} for ${nextTier[tier] === "Platinum" ? "unlimited" : `up to ${TIER_NICHE_LIMITS[nextTier[tier]!]}`} niches, or ask an admin for a bonus niche.`
      : "";
    return { ok: false, message: `${tier} members get ${limit} niche${limit === 1 ? "" : "s"}.${upgradeHint}` };
  }
  return { ok: true };
}
