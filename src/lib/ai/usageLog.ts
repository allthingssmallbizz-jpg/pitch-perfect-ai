// The AI usage log: one row for EVERY call to the Anthropic API — finished, cut off, stopped by a
// time budget, or failed — with its tokens and cost, so the app's numbers match the Anthropic
// bill. Feature tables (generations, strategy_reviews, webinar_scores) only keep the cost of runs
// that finished, which hid coach chats, retries, and failed attempts.
//
// Routes tag their calls once with tagAiUsage({ feature, userId, projectId }); every AI call made
// later in that request is logged with the tag. An untagged call is still logged ("untagged"), so
// totals stay complete. Logging never breaks or blocks a generation for long — a failed insert is
// reported to the server log and skipped.

import { AsyncLocalStorage } from "node:async_hooks";
import type Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export type AiUsageTag = {
  feature: string;
  userId?: string | null;
  projectId?: string | null;
};

const storage = new AsyncLocalStorage<AiUsageTag>();

// Tags every AI call made from here on in the current request.
export function tagAiUsage(tag: AiUsageTag): void {
  storage.enterWith(tag);
}

// Runs `fn` with its own tag (for work that should be labeled differently from the request).
export function withAiUsageTag<T>(tag: AiUsageTag, fn: () => Promise<T>): Promise<T> {
  return storage.run(tag, fn);
}

export type AiCallStatus = "ok" | "cut_off" | "stopped" | "error";

// $ per million tokens. Cache writes cost 1.25x input and cache reads 0.1x input on these models.
// ANTHROPIC_INPUT_COST_PER_MTOK / ANTHROPIC_OUTPUT_COST_PER_MTOK override the table when set.
const MODEL_PRICES: { match: RegExp; input: number; output: number }[] = [
  { match: /opus-5-5/, input: 4, output: 20 },
  { match: /sonnet/, input: 2, output: 10 },
];

export function pricesFor(model: string | null | undefined): { input: number; output: number } {
  const envIn = process.env.ANTHROPIC_INPUT_COST_PER_MTOK;
  const envOut = process.env.ANTHROPIC_OUTPUT_COST_PER_MTOK;
  const table = MODEL_PRICES.find((p) => p.match.test(model ?? "")) ?? { input: 2, output: 10 };
  return {
    input: envIn ? Number(envIn) : table.input,
    output: envOut ? Number(envOut) : table.output,
  };
}

export type AiCallUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
};

export function costForUsage(model: string | null | undefined, u: AiCallUsage): number {
  const p = pricesFor(model);
  const inputEquivalent = u.inputTokens + u.cacheWriteTokens * 1.25 + u.cacheReadTokens * 0.1;
  return (inputEquivalent / 1_000_000) * p.input + (u.outputTokens / 1_000_000) * p.output;
}

export function usageFromMessage(usage: Anthropic.Usage | undefined | null): AiCallUsage {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
  };
}

let warnedMissingTable = false;

export async function recordAiCall(entry: {
  model: string | null;
  status: AiCallStatus;
  usage: AiCallUsage;
  outputEstimated?: boolean;
  durationMs: number;
  error?: string | null;
  requestId?: string | null;
}): Promise<void> {
  const tag = storage.getStore();
  try {
    const { error } = await createAdminClient()
      .from("ai_usage_log")
      .insert({
        user_id: tag?.userId ?? null,
        project_id: tag?.projectId ?? null,
        feature: tag?.feature ?? "untagged",
        model: entry.model,
        status: entry.status,
        input_tokens: entry.usage.inputTokens,
        output_tokens: entry.usage.outputTokens,
        cache_write_tokens: entry.usage.cacheWriteTokens,
        cache_read_tokens: entry.usage.cacheReadTokens,
        output_estimated: entry.outputEstimated ?? false,
        cost_usd: costForUsage(entry.model, entry.usage),
        duration_ms: Math.round(entry.durationMs),
        error: entry.error ? entry.error.slice(0, 500) : null,
        request_id: entry.requestId ?? null,
      });
    if (error) throw error;
  } catch (err) {
    // Most likely the ai_usage_log migration hasn't been run yet — say so once, not per call.
    if (!warnedMissingTable) {
      warnedMissingTable = true;
      console.error("AI usage log: couldn't record an AI call (has migration 0057 been run?)", err);
    }
  }
}
