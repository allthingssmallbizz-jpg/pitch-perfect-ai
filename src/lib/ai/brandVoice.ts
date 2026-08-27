import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Folded into every generation's system prompt (see systemPrompt.ts) so webinars, VSLs,
// ads, emails — everything — sound consistently like the user, not like generic AI copy.
export async function getBrandVoiceBlock(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase.from("brand_voices").select("*").eq("user_id", userId).maybeSingle();

  if (!data) return null;

  const { tone, preferred_words, forbidden_words, sample_writing, extra_notes, primary_color, secondary_color } = data;
  const hasVoice = tone.trim() || preferred_words.trim() || forbidden_words.trim() || sample_writing.trim() || extra_notes.trim();
  const hasColors = primary_color.trim() || secondary_color.trim();
  if (!hasVoice && !hasColors) return null;

  const lines: string[] = [];

  if (hasVoice) {
    lines.push("BRAND VOICE — match this voice in every section of the output:");
    if (tone.trim()) lines.push(`Tone: ${tone.trim()}`);
    if (preferred_words.trim()) lines.push(`Prefer these words/phrases where natural: ${preferred_words.trim()}`);
    if (forbidden_words.trim()) lines.push(`Never use these words/phrases: ${forbidden_words.trim()}`);
    if (extra_notes.trim()) lines.push(`Additional voice notes: ${extra_notes.trim()}`);
    if (sample_writing.trim()) {
      lines.push(`Sample of the user's own writing — mirror this rhythm and vocabulary:\n"""\n${sample_writing.trim()}\n"""`);
    }
  }

  // Only meaningful to generators that produce actual visual design (currently the Landing Page
  // HTML generator) — every other generator just ignores this, harmlessly.
  if (hasColors) {
    if (lines.length) lines.push("");
    lines.push("BRAND COLORS — for any generator that produces visual design (e.g. a landing page), use these as the accent color scheme instead of picking your own:");
    if (primary_color.trim()) lines.push(`Primary color: ${primary_color.trim()}`);
    if (secondary_color.trim()) lines.push(`Secondary color: ${secondary_color.trim()}`);
  }

  return lines.join("\n");
}
