import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGuardrails, decrementCredits } from "@/lib/credits";
import { generateAsset } from "@/lib/ai/anthropic";
import {
  BRAND_COLOR_STYLES,
  BRAND_COLOR_SURPRISE_CREDIT_COST,
  BRAND_COLOR_SURPRISE_MAX_OUTPUT_TOKENS,
  buildBrandColorPalettePrompt,
  parseBrandColorPaletteResponse,
} from "@/lib/ai/brandColorPalette";

export const runtime = "nodejs";

const requestSchema = z.object({
  style: z.enum(BRAND_COLOR_STYLES.map((s) => s.id) as [string, ...string[]]),
});

// "Surprise me" on the Brand Voice page — for a member who'd rather pick a design style than
// type hex codes themselves. Same guardrail pipeline and lightweight-telemetry generations row
// as discovery_assist/website_import/offer_builder; nothing is saved to brand_voices here, the
// suggested palette just lands in the form for review (see BrandVoiceForm.tsx).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a design style first." }, { status: 400 });
  }
  const { style } = parsed.data;

  const guardrail = await checkGuardrails(user.id, BRAND_COLOR_SURPRISE_CREDIT_COST);
  if (!guardrail.ok) {
    return NextResponse.json({ error: guardrail.message, reason: guardrail.reason }, { status: 429 });
  }

  try {
    const { system, user: userMessage } = buildBrandColorPalettePrompt(style);
    const result = await generateAsset(system, userMessage, BRAND_COLOR_SURPRISE_MAX_OUTPUT_TOKENS);
    const palette = parseBrandColorPaletteResponse(result.content);
    if (!palette) {
      return NextResponse.json({ error: "Could not generate a palette — try again." }, { status: 502 });
    }

    const admin = createAdminClient();
    await admin.from("generations").insert({
      user_id: user.id,
      project_id: null,
      asset_type: "brand_color_surprise",
      mode: "expert",
      status: "complete",
      content: JSON.stringify(palette),
      input_content: `style=${style}`,
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      credits_charged: BRAND_COLOR_SURPRISE_CREDIT_COST,
    });
    await decrementCredits(user.id, BRAND_COLOR_SURPRISE_CREDIT_COST);

    return NextResponse.json({ palette });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate a palette";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
