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

  const { tone, preferred_words, forbidden_words, sample_writing, extra_notes } = data;
  if (!tone.trim() && !preferred_words.trim() && !forbidden_words.trim() && !sample_writing.trim() && !extra_notes.trim()) {
    return null;
  }

  const lines = ["BRAND VOICE — match this voice in every section of the output:"];
  if (tone.trim()) lines.push(`Tone: ${tone.trim()}`);
  if (preferred_words.trim()) lines.push(`Prefer these words/phrases where natural: ${preferred_words.trim()}`);
  if (forbidden_words.trim()) lines.push(`Never use these words/phrases: ${forbidden_words.trim()}`);
  if (extra_notes.trim()) lines.push(`Additional voice notes: ${extra_notes.trim()}`);
  if (sample_writing.trim()) {
    lines.push(`Sample of the user's own writing — mirror this rhythm and vocabulary:\n"""\n${sample_writing.trim()}\n"""`);
  }

  return lines.join("\n");
}
