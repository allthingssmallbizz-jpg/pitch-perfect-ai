export const HEADLINE_LAB_CREDIT_COST = 3;
// Raised from 2500, then 4000 — each entry now also carries a full subheadline alongside the
// headline/score/reasoning, which adds meaningful length across 20 entries. Hitting the limit
// mid-object truncates the JSON (an unterminated string/object), which used to fail the whole
// generation outright. parseRatedHeadlines below is lenient about that too, but more headroom
// means it happens less in the first place.
export const HEADLINE_LAB_MAX_OUTPUT_TOKENS = 6000;

export type RatedHeadline = {
  headline: string;
  // Most people don't know how to write a subheadline any more than they know how to write a
  // headline, so this is produced automatically alongside every headline rather than left as a
  // separate step — same power/transformation level as its headline, not an afterthought.
  subheadline: string;
  score: number;
  reasoning: string;
};

export function buildHeadlineLabPrompt(topic: string, audience: string, promise: string): string {
  return `Generate 20 headline options — each with a matching subheadline — and rate each pair, using direct-response copywriting judgment (specificity, curiosity, the promise being clear, believability).

Topic/product: ${topic}
Target audience: ${audience || "(not specified — infer a reasonable one from the topic)"}
Core promise: ${promise || "(not specified — infer the strongest plausible promise from the topic)"}

SUBHEADLINE RULE — every single headline gets a matching subheadline, no exceptions:
The subheadline is not a restatement of the headline and not a weaker afterthought — it should be
just as transformational and just as powerful, doing a different job: it earns the click/keep-
reading by adding the ONE most compelling piece of specificity the headline didn't have room for —
the mechanism, the timeframe, who exactly it's for, or the proof point. If the headline is the
promise, the subheadline is the "here's how, and here's why you can believe it" in one tight line.

Vary the angles and formulas across the 20 — mix in these named direct-response formulas by name,
don't just default to generic curiosity/benefit headlines every time:
- **Who Else** — "Who Else Wants [desired result]?" (taps social proof + universal desire)
- **Discover How To ___ Without ___** — "Discover How You Can [achieve the promise] Without [the thing they currently hate/fear/have to do]" (names the promise AND removes the biggest objection in one line)
- **Learn How To ___ Without ___** — same "without" mechanic, framed as learning/mastering a skill rather than achieving an outcome
- Plus the rest of the standard toolkit: direct benefit, contrarian/pattern-interrupt, social proof, urgency, question-based, plain "how to", identity-based

Distribute these across the 20 so no single formula dominates, and don't repeat the same structure back to back.

Respond with ONLY a JSON array — no prose before or after, no markdown code fence — of exactly 20 objects matching this shape:
[{"headline": "...", "subheadline": "...", "score": 8, "reasoning": "one sentence on why this score"}, ...]

Score 1-10 honestly — a weak, generic headline should score low, not get inflated to make the list look better. Score the headline+subheadline pair as a whole.`;
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
    subheadline: typeof record.subheadline === "string" ? record.subheadline.trim() : "",
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
