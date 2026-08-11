import type { ImageInput } from "./anthropic";
import type { SocialProfileExtraction } from "@/lib/social";

// Compares a member's own social page against a high-performing page they admire. Two ways
// material gets in per side: a URL fetch (whatever Open Graph title/description/preview-image
// the platform exposes — see src/lib/social.ts for why that's the realistic ceiling without
// official API access, and why Instagram/Facebook often yield nothing at all), or member-
// uploaded screenshots, which work regardless of what a platform allows automated tools to see.
// Deliberately framed around honesty about whatever's actually available rather than pretending
// to have reviewed a full post history it was never shown.

export const SOCIAL_COMPARE_CREDIT_COST = 5;
export const SOCIAL_COMPARE_MAX_OUTPUT_TOKENS = 4000;

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  other: "the platform",
};

function describeExtraction(label: string, p: SocialProfileExtraction): string {
  const lines = [
    `${label} (${PLATFORM_LABELS[p.platform] ?? p.platform}) — ${p.finalUrl}`,
    p.title ? `Title/name: ${p.title}` : `Title/name: (none available)`,
    p.description ? `Bio/description: ${p.description}` : `Bio/description: (none available)`,
    p.bodyTextSnippet.length > 50
      ? `Additional visible page text (may include navigation noise — use judgment):\n"""\n${p.bodyTextSnippet.slice(0, 2500)}\n"""`
      : `Additional visible page text: (none available)`,
    p.images.length > 0
      ? `${p.images.length} image${p.images.length === 1 ? "" : "s"} for this page ARE included below.`
      : `No images were available for this page.`,
  ];
  return lines.join("\n");
}

export function buildSocialComparePrompt(
  yours: SocialProfileExtraction,
  reference: SocialProfileExtraction
): { system: string; user: string; images?: ImageInput[] } {
  const images: ImageInput[] = [];
  const imageLabels: string[] = [];
  for (const img of yours.images) {
    images.push(img);
    imageLabels.push(`IMAGE ${images.length} = for YOUR page.`);
  }
  for (const img of reference.images) {
    images.push(img);
    imageLabels.push(`IMAGE ${images.length} = for the REFERENCE (high-performing) page.`);
  }

  const system = `You are a social media growth strategist doing a side-by-side competitive comparison between a member's own page and a high-performing page they want to learn from.

CRITICAL RULES:
1. Only comment on what's actually provided below (title/bio text, page text, and images if included). You have NOT seen either page's actual post history, view counts, analytics, or individual videos unless an image is explicitly provided — never write as if you scrolled their feed or watched their videos.
2. If the material for a page is thin (just a title/bio, no body text, no image), say so plainly in your output rather than inventing generic detail to fill the gap. A short, honest section beats a long, made-up one.
3. Never invent specific numbers (follower counts, view counts, engagement rates) that weren't given to you.
4. Where images are provided, describe what you actually see (composition, color, text overlay style, subject framing, thumbnail style) rather than generic thumbnail advice — if several images are provided for one page, treat them as a set and note patterns across them.
5. Ground every recommendation in a specific contrast between the two pages' actual material — not generic "post more consistently" filler advice.

OUTPUT FORMAT (markdown):
## Profile & Positioning
Compare the bio/description/title material — tone, clarity, what each communicates about who the page is for.

## Visual Style${images.length ? "" : " (limited — no images were available to compare)"}
${images.length ? "Compare what's actually visible in the provided image(s) — composition, text overlays, color, subject framing, thumbnail style." : "Note that no images were available and keep this section brief rather than inventing visual detail."}

## Content & Caption Patterns
Compare whatever caption/description/page-text material is available for signal on tone, hook style, and messaging.

## Data Limitations
One or two honest sentences on what wasn't available for either page and therefore isn't reflected above (e.g. "no visible post captions were readable for [page]").

## What To Change
A numbered, prioritized list (most impactful first) of specific, concrete changes for the member's own page, each one explicitly grounded in a contrast with the reference page's actual material above — not generic advice.`;

  const user = `${describeExtraction("YOUR PAGE", yours)}

${describeExtraction("REFERENCE PAGE (high-performing, to learn from)", reference)}

${imageLabels.length ? imageLabels.join("\n") + "\n" : "No images were available for either page.\n"}
Write the comparison now, following the OUTPUT FORMAT exactly.`;

  return { system, user, images: images.length ? images : undefined };
}
