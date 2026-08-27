// "Surprise me" — for a member who doesn't want to pick hex codes themselves and doesn't have
// existing brand colors to type in, this drafts a full 4-color palette (src/lib/actions/
// brandVoice.ts's COLOR_FIELDS) that actually looks like a cohesive, designed-together palette,
// based on a design style they pick rather than a blank text prompt. Same review-before-save
// pattern as everywhere else this app drafts something on someone's behalf: the suggested colors
// land in the form fields for review, nothing is saved until they hit Save themselves.

export const BRAND_COLOR_SURPRISE_CREDIT_COST = 1;
export const BRAND_COLOR_SURPRISE_MAX_OUTPUT_TOKENS = 300;

export const BRAND_COLOR_STYLES = [
  {
    id: "luxury",
    label: "Luxury",
    guidance:
      "Deep, rich jewel tones or black paired with a metallic gold/champagne accent. High contrast, restrained color count, feels expensive and exclusive rather than loud.",
  },
  {
    id: "corporate",
    label: "Corporate",
    guidance:
      "Trustworthy navy/blue-based primary, clean and low-saturation, a confident single accent. Reads as established and credible, not flashy.",
  },
  {
    id: "professional",
    label: "Professional",
    guidance:
      "Similar restraint to corporate but slightly warmer/more approachable — a confident primary (can be outside blue), neutral secondary, one clear accent for CTAs. Polished, not sterile.",
  },
  {
    id: "subtle",
    label: "Subtle & Minimal",
    guidance:
      "Muted, mostly-neutral tones (soft grays, off-whites, dusty colors) with one gentle accent used sparingly. Calm, uncluttered, quietly confident rather than attention-grabbing.",
  },
  {
    id: "bold",
    label: "Bold & Vibrant",
    guidance:
      "High-saturation, high-energy, real contrast between primary and secondary — colors that grab attention and feel confident/energetic. Still cohesive, not clashing.",
  },
  {
    id: "modern",
    label: "Modern & Tech",
    guidance:
      "Clean, slightly cool palette — think electric blue, violet, or teal as primary, dark neutral secondary, one bright accent. Feels current, digital-native, product-forward.",
  },
  {
    id: "playful",
    label: "Playful & Friendly",
    guidance:
      "Warm, approachable, rounded-feeling colors — coral, warm yellow, friendly teal/green territory. Energetic but not aggressive, welcoming rather than corporate.",
  },
  {
    id: "elegant",
    label: "Elegant",
    guidance:
      "Soft, sophisticated tones — dusty rose, sage, cream, deep plum — or deep tones with a soft gold/cream accent. Refined and understated, not bright.",
  },
] as const;

export type BrandColorStyleId = (typeof BRAND_COLOR_STYLES)[number]["id"];

export type BrandColorPalette = {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  outline_color: string;
};

export function buildBrandColorPalettePrompt(styleId: string): { system: string; user: string } {
  const style = BRAND_COLOR_STYLES.find((s) => s.id === styleId);

  const system = `You are a professional brand/UI color palette designer. Given a design style, produce one cohesive, genuinely good-looking 4-color web palette: a primary, a secondary, an accent, and a neutral outline/border color.

CRITICAL RULES:
1. Output ONLY a single valid JSON object, nothing before or after it — no markdown code fence, no commentary.
2. The object must have exactly these 4 keys, each a 6-digit hex code string starting with "#": "primary_color", "secondary_color", "accent_color", "outline_color".
3. Primary and secondary must have real, deliberate contrast with each other — not two shades of the same color, and not so similar they look like a mistake.
4. Accent is for small highlights (badges, icons, small CTAs) — it should be a genuinely distinct hue from primary/secondary, not just a lighter or darker version of one of them, while still fitting the same overall palette.
5. Outline/border must be a soft, low-saturation, mostly-neutral color (a light gray or a heavily desaturated tint that fits the palette) suitable for borders and dividers — never a bright or highly saturated color.
6. The 4 colors together must look like they were chosen by the same designer in one sitting — genuinely pleasant and usable on a real website, not a random/generated-looking set.`;

  const user = `Design style: ${style?.label ?? styleId}
Style guidance: ${style?.guidance ?? "Use your best judgment for a palette matching this style name."}

Generate the 4-color palette now as the JSON object described.`;

  return { system, user };
}

// Defensive parse, same approach as parseWebsiteImportResponse/parseOfferBuilderResponse —
// malformed output returns null rather than throwing, so the caller can show a plain "try again"
// instead of a hard error.
export function parseBrandColorPaletteResponse(raw: string): BrandColorPalette | null {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\n?/i, "").replace(/\n?```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const obj = parsed as Record<string, unknown>;
  const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const keys: (keyof BrandColorPalette)[] = ["primary_color", "secondary_color", "accent_color", "outline_color"];

  const result: Partial<BrandColorPalette> = {};
  for (const key of keys) {
    const value = obj[key];
    if (typeof value !== "string" || !hexPattern.test(value.trim())) return null;
    result[key] = value.trim();
  }

  return result as BrandColorPalette;
}
