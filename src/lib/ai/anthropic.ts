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
  stopReason: Anthropic.Message["stop_reason"];
}

export type ImageInput = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

// Single call site for every generator. Output length is always capped server-side
// (maxOutputTokens) — this is one of the margin-protection guardrails from the build spec:
// no single generation can produce an unbounded (and unboundedly expensive) response.
//
// `images` is used by Agent Annie's video analysis path — sample frames extracted from an
// uploaded video, sent alongside the transcript so Claude can comment on slide legibility
// and presenter framing. Claude's API has no native video input, so this still only gives
// still-frame visual signal, not motion/audio — see the comment in videoAnalyzer.ts.
export async function generateAsset(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number,
  images?: ImageInput[]
): Promise<GenerateResult> {
  const anthropic = getClient();

  const messageContent: Anthropic.MessageParam["content"] = images?.length
    ? [
        ...images.map((img) => ({
          type: "image" as const,
          source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
        })),
        { type: "text" as const, text: userPrompt },
      ]
    : userPrompt;

  const message = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: maxOutputTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: messageContent }],
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
    stopReason: message.stop_reason,
  };
}

// Wraps generateAsset with automatic continuation: if Claude's response hits maxOutputTokens
// before naturally finishing (stop_reason "max_tokens" — e.g. a 60-90 slide PPT outline that
// doesn't fit in one response), this asks it to continue exactly where it left off, up to
// maxContinuations more calls, and stitches the results together. Without this, a long-form
// generator can silently cut off mid-sentence with no indication anything was truncated —
// no fixed token cap can guarantee covering every business's content density in one shot.
// Costs/tokens across all calls are summed into a single result.
export async function generateCompleteAsset(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number,
  images?: ImageInput[],
  maxContinuations = 4
): Promise<GenerateResult> {
  const first = await generateAsset(systemPrompt, userPrompt, maxOutputTokens, images);

  let combinedContent = first.content;
  let totalInputTokens = first.inputTokens;
  let totalOutputTokens = first.outputTokens;
  let stopReason = first.stopReason;
  let model = first.model;

  const anthropic = getClient();
  const messageContent: Anthropic.MessageParam["content"] = images?.length
    ? [
        ...images.map((img) => ({
          type: "image" as const,
          source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
        })),
        { type: "text" as const, text: userPrompt },
      ]
    : userPrompt;

  let continuations = 0;
  while (stopReason === "max_tokens" && continuations < maxContinuations) {
    continuations++;
    const message = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: maxOutputTokens,
      system: systemPrompt,
      messages: [
        { role: "user", content: messageContent },
        { role: "assistant", content: combinedContent },
        {
          role: "user",
          content:
            "Continue exactly where you left off — don't repeat anything already written, don't restart or summarize, just keep going from the exact next word/slide/section.",
        },
      ],
    });

    const continuationText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    combinedContent += continuationText;
    totalInputTokens += message.usage.input_tokens;
    totalOutputTokens += message.usage.output_tokens;
    stopReason = message.stop_reason;
    model = message.model;
  }

  return {
    content: combinedContent,
    model,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    costUsd: estimateCostUsd(totalInputTokens, totalOutputTokens),
    stopReason,
  };
}
