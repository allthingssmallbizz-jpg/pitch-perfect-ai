// "I Help Statement" generator — most people asked to write "I help [audience] [outcome] with
// [mechanism]" cold either freeze or write something generic ("I help people grow their business
// with coaching"). This takes their plain-language answers to a few guided questions and drafts
// several sharper, more specific candidate statements to choose from instead, the same
// generate-many-rate-and-pick shape as Headline Lab (headlineLab.ts) rather than Offer Builder's
// single-draft-per-field shape, since here every candidate is a full alternative of the same one
// line, not several different fields.
export const IHELP_BUILDER_CREDIT_COST = 2;
export const IHELP_BUILDER_MAX_OUTPUT_TOKENS = 1500;

export type RatedIHelpStatement = {
  statement: string;
  score: number;
  reasoning: string;
};

export function buildIHelpBuilderPrompt(
  audience: string,
  outcome: string,
  mechanism: string,
  painPoint: string
): string {
  return `Generate 5 alternative "I Help Statement" options and rate each one, using direct-response positioning judgment (specificity, believability, and whether a stranger would instantly understand who this is for and what changes for them).

An "I Help Statement" is the classic one-line positioning answer to "what do you do?" — the format is "I help [specific audience] [achieve a specific outcome] with/using [mechanism]." The single biggest failure mode is vagueness — "I help people grow their business with coaching" describes nobody and promises nothing. Every option must be concrete enough that the target person would recognize themselves immediately.

The member's own words (plain language, not yet polished — your job is to sharpen and specify, not to invent a different business):
Who they help: ${audience}
The result they help them get: ${outcome}
How they help them get it: ${mechanism}
${painPoint.trim() ? `The audience's biggest struggle right now: ${painPoint.trim()}` : "(No pain point given — infer a plausible, specific one from the audience/outcome instead of leaving it generic.)"}

Vary the 5 options across these angles, don't just reword the same sentence 5 times:
- Tightest, most literal version of their own words, just sharpened and de-jargoned
- Lead with the audience's specific struggle/frustration before the outcome (makes the audience feel seen)
- Lead with a vivid, specific version of the outcome (makes the promise concrete — a number, timeframe, or before/after if one is plausible)
- A version that names what makes their mechanism different, not just "with coaching" or "with webinars"
- A version using a "without [the thing they hate/fear]" structure if one plausibly fits (e.g. "...without feeling like a tech expert")

Keep every option to one sentence, genuinely usable as-is — no placeholders, no brackets left in.

Respond with ONLY a JSON array — no prose before or after, no markdown code fence — of exactly 5 objects matching this shape:
[{"statement": "I help ...", "score": 8, "reasoning": "one sentence on why this angle works"}, ...]

Score 1-10 honestly — a flat or generic option should score low, not get inflated to make the list look better.`;
}

function coerceStatement(item: unknown): RatedIHelpStatement | null {
  if (typeof item !== "object" || item === null) return null;
  const record = item as Record<string, unknown>;
  const statement = record.statement;
  if (typeof statement !== "string" || !statement.trim()) return null;

  const rawScore = record.score;
  const score = typeof rawScore === "number" ? rawScore : typeof rawScore === "string" ? Number(rawScore) : NaN;
  if (!Number.isFinite(score)) return null;

  return {
    statement: statement.trim(),
    score,
    reasoning: typeof record.reasoning === "string" ? record.reasoning : "",
  };
}

// Same lenient two-pass parse as parseRatedHeadlines — a straightforward JSON.parse first, and if
// that fails (a stray preamble, or truncation mid-object), fall back to pulling out every
// individual {...} it can find so a partial response still returns something instead of nothing.
export function parseIHelpStatements(content: string): RatedIHelpStatement[] {
  const cleaned = content.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      const statements = parsed.map(coerceStatement).filter((s): s is RatedIHelpStatement => s !== null);
      if (statements.length > 0) return statements;
    }
  } catch {
    // Fall through to the lenient extraction below.
  }

  const matches = cleaned.match(/\{[^{}]*\}/g) ?? [];
  const statements: RatedIHelpStatement[] = [];
  for (const match of matches) {
    try {
      const coerced = coerceStatement(JSON.parse(match));
      if (coerced) statements.push(coerced);
    } catch {
      // Skip this one malformed/truncated entry, keep whatever else parses.
    }
  }

  if (statements.length === 0) {
    throw new Error("Could not parse any statements from the response — try again.");
  }
  return statements;
}
