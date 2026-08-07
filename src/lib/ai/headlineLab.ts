export const HEADLINE_LAB_CREDIT_COST = 3;
export const HEADLINE_LAB_MAX_OUTPUT_TOKENS = 2500;

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

// Claude is instructed to return raw JSON, but strips a code fence defensively in case it
// adds one anyway.
export function parseRatedHeadlines(content: string): RatedHeadline[] {
  const cleaned = content.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed: unknown = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of headlines");

  return parsed.map((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).headline !== "string" ||
      typeof (item as Record<string, unknown>).score !== "number"
    ) {
      throw new Error("Malformed headline entry");
    }
    const record = item as Record<string, unknown>;
    return {
      headline: record.headline as string,
      score: record.score as number,
      reasoning: typeof record.reasoning === "string" ? record.reasoning : "",
    };
  });
}
