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
  const ihelp = composeIHelpStatement(
    data.presenter_ihelp_audience,
    data.presenter_ihelp_outcome,
    data.presenter_ihelp_mechanism
  );

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

// True when every field is blank (or no row exists yet) — used both to decide whether to fold
// anything into the system prompt above, and to drive the "finish your bio first?" reminder on
// the Webinar/VSL generate pages.
export function isPresenterBioEmpty(bio: PresenterBioFields | null | undefined): boolean {
  if (!bio) return true;
  return Object.values(bio).every((v) => !v.trim());
}
