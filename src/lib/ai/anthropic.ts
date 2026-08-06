import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// $ per million tokens. Override via env if your negotiated/current pricing differs —
// verify against https://docs.claude.com/en/docs/about-claude/pricing before relying on
// these for real billing decisions.
const INPUT_COST_PER_MTOK = Number(process.env.ANTHROPIC_INPUT_COST_PER_MTOK ?? 3);
const OUTPUT_COST_PER_MTOK = Number(process.env.ANTHROPIC_OUTPUT_COST_PER_MTOK ?? 15);

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * INPUT_COST_PER_MTOK +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK
  );
}

export interface GenerateResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

// Single call site for every generator. Output length is always capped server-side
// (maxOutputTokens) — this is one of the margin-protection guardrails from the build spec:
// no single generation can produce an unbounded (and unboundedly expensive) response.
export async function generateAsset(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number
): Promise<GenerateResult> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: maxOutputTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const inputTokens = message.usage.input_tokens;
  const outputTokens = message.usage.output_tokens;

  return {
    content,
    model: message.model,
    inputTokens,
    outputTokens,
    costUsd: estimateCostUsd(inputTokens, outputTokens),
  };
}
