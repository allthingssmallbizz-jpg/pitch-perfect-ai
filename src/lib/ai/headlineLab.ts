export const HEADLINE_LAB_CREDIT_COST = 3;
// Raised from 2500 — 20 headlines each with a score and a full reasoning sentence can run close
// to that limit, and hitting it mid-array truncates the JSON (an unterminated string/object),
// which used to fail the whole generation outright. parseRatedHeadlines below is now lenient
// about that too, but more headroom means it happens less in the first place.
export const HEADLINE_LAB_MAX_OUTPUT_TOKENS = 4000;

export type RatedHeadline = {
  headline: string;
  score: number;
  reasoning: string;
};

export function buildHeadlineLabPrompt(topic: string, audience: string, promise: string): string {
  return `Generate 20 headline options and rate each one, using direct-response copywriting judgment (specificity, curiosity, the promise being clear, believability).

Topic/product: ${topic}
Target audience: ${audience || "(not specified — infer a reasonable one from the topic)"}
Core promise: ${promise || "(not specified — infer the strongest plausible promise from the topic)"}

Vary the angles across the 20: curiosity, direct benefit, contrarian/pattern-interrupt, social proof, urgency, question-based, "how to", identity-based. Don't repeat the same structure 20 times.

Respond with ONLY a JSON array — no prose before or after, no markdown code fence — of exactly 20 objects matching this shape:
[{"headline": "...", "score": 8, "reasoning": "one sentence on why this score"}, ...]

Score 1-10 honestly — a weak, generic headline should score low, not get inflated to make the list look better.`;
}

function coerceHeadline(item: unknown): RatedHeadline | null {
  if (typeof item !== "object" || item === null) return null;
  const record = item as Record<string, unknown>;
  const headline = record.headline;
  if (typeof headline !== "string" || !headline.trim()) return null;

  const rawScore = record.score;
  const score = typeof rawScore === "number" ? rawScore : typeof rawScore === "string" ? Number(rawScore) : NaN;
  if (!Number.isFinite(score)) return null;

  return {
    headline: headline.trim(),
    score,
    reasoning: typeof record.reasoning === "string" ? record.reasoning : "",
  };
}

// Claude is instructed to return raw JSON, but this used to throw on the first thing that
// wasn't a perfectly well-formed array — including a response truncated by hitting
// HEADLINE_LAB_MAX_OUTPUT_TOKENS mid-object (an unterminated string/array is invalid JSON), or a
// stray preamble/postamble sentence despite the "only JSON" instruction. Either one failed the
// whole generation with no headlines at all and no credits charged, even when most of the 20
// entries had actually come back fine. Now tries a straightforward parse first, and if that
// fails, falls back to pulling out every individual {...} object regardless of what surrounds
// it — a partial, truncated response still returns however many headlines it managed to finish
// rather than nothing.
export function parseRatedHeadlines(content: string): RatedHeadline[] {
  const cleaned = content.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      const headlines = parsed.map(coerceHeadline).filter((h): h is RatedHeadline => h !== null);
      if (headlines.length > 0) return headlines;
    }
  } catch {
    // Fall through to the lenient extraction below.
  }

  const matches = cleaned.match(/\{[^{}]*\}/g) ?? [];
  const headlines: RatedHeadline[] = [];
  for (const match of matches) {
    try {
      const coerced = coerceHeadline(JSON.parse(match));
      if (coerced) headlines.push(coerced);
    } catch {
      // Skip this one malformed/truncated entry, keep whatever else parses.
    }
  }

  if (headlines.length === 0) {
    throw new Error("Could not parse any headlines from the response — try again.");
  }
  return headlines;
}
