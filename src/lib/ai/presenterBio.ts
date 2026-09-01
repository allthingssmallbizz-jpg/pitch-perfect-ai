import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// One row per user, filled in once on its own /bio page (see src/app/(app)/bio) — folded into
// every generation's system prompt the same way getBrandVoiceBlock is, so a member never
// re-answers "how did you get into this industry" per project. Feeds the Credibility Bridge and
// Opening Story beats specifically, but is available to every generator.
export async function getPresenterBioBlock(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase.from("presenter_bios").select("*").eq("user_id", userId).maybeSingle();
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
// Same two fields Aaron said are fine to skip stay off this list — Credentials/certifications and
// Media/speaking/industry recognition are real answers even when genuinely blank ("none yet"),
// not a sign the bio was rushed. The three raw "I Help" parts stand in for the crafted statement
// itself (composeIHelpStatement derives a usable fallback from them — see getPresenterBioBlock
// above), so the statement box and the explicitly-optional "biggest struggle" field aren't
// separately required here.
export const REQUIRED_BIO_FIELDS: { key: keyof PresenterBioFields; label: string }[] = [
  { key: "presenter_ihelp_audience", label: "I Help Statement — who you help" },
  { key: "presenter_ihelp_outcome", label: "I Help Statement — the outcome" },
  { key: "presenter_ihelp_mechanism", label: "I Help Statement — your mechanism" },
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
