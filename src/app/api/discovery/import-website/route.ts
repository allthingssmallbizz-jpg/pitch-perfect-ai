import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateAsset } from "@/lib/ai/anthropic";
import { fetchWebsiteText, WebsiteFetchError } from "@/lib/website";
import {
  WEBSITE_IMPORT_CREDIT_COST,
  WEBSITE_IMPORT_MAX_OUTPUT_TOKENS,
  buildWebsiteImportPrompt,
  parseWebsiteImportResponse,
} from "@/lib/ai/websiteImport";

export const runtime = "nodejs";
// Fetching an external site plus a full-context Claude call can run past a default timeout on
// some plans — same reasoning as /api/generate's maxDuration.
export const maxDuration = 60;

const requestSchema = z.object({
  url: z.string().min(1).max(500),
  projectId: z.string().uuid().optional(),
});

// "Import from your website" on the discovery form — reads a member's own site and drafts as
// many discovery fields as it supports, so they aren't typing their whole offer from scratch.
// Same guardrail pipeline as every other paid call; logs a lightweight generations row purely
// for cost telemetry (see supabase/migrations/0015_website_import.sql), same as discovery_assist.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const { url, projectId } = parsed.data;

  const guardrail = await checkGuardrails(user.id, WEBSITE_IMPORT_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  let websiteText: string;
  let finalUrl: string;
  try {
    const fetched = await fetchWebsiteText(url);
    websiteText = fetched.text;
    finalUrl = fetched.finalUrl;
  } catch (err) {
    if (err instanceof WebsiteFetchError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't read that website — try again." }, { status: 400 });
  }

  try {
    const { system, user: userMessage } = buildWebsiteImportPrompt(websiteText, finalUrl);
    const result = await generateAsset(system, userMessage, WEBSITE_IMPORT_MAX_OUTPUT_TOKENS);
    const fields = parseWebsiteImportResponse(result.content);

    const admin = createAdminClient();
    await admin.from("generations").insert({
      user_id: user.id,
      project_id: projectId ?? null,
      asset_type: "website_import",
      mode: "expert",
      status: "complete",
      content: JSON.stringify(fields),
      input_content: `url=${finalUrl}`,
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      credits_charged: WEBSITE_IMPORT_CREDIT_COST,
    });
    await decrementCredits(user.id, WEBSITE_IMPORT_CREDIT_COST);

    return NextResponse.json({ fields });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
