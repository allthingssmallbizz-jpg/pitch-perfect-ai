import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";
import { CSS_VAR_DESIGN_BLOCK } from "./htmlPage";
import type { FunnelType } from "@/lib/funnelType";

export const THANK_YOU_PAGE_CREDIT_COST = 2;
export const THANK_YOU_PAGE_MAX_OUTPUT_TOKENS = 6000;

// What actually needs to be true on the page depends entirely on what the CTA led to — a
// "book a call" thank-you page and a "you just bought" receipt page share almost nothing.
// Keyed by FunnelType so this stays exhaustive as new funnel types are added.
const FUNNEL_INSTRUCTIONS: Record<FunnelType, string> = {
  book_call: `This CTA was to BOOK A CALL. Build the page around what happens next in that process:
- Confirm the call is booked and congratulate them on taking the step — no "purchase" language anywhere, they haven't bought anything yet.
- Tell them exactly what to expect on the call (what will be covered, roughly how long it runs, that it's a real conversation, not a scripted pitch).
- Give them 2-3 things to do to prepare (e.g. "think through your current numbers," "have your biggest question ready") so they show up engaged, not cold.
- Set expectations for reminders (a calendar invite / confirmation email is on its way) and what to do if they need to reschedule.
- Reinforce the transformation this call is the first step toward — restate the core promise briefly, not a full re-pitch.`,
  checkout: `This CTA was a CHECKOUT / DIRECT PURCHASE. This is a real order confirmation page — treat it accordingly:
- Confirm the purchase clearly (what they bought, that it's confirmed) and open with genuine excitement/welcome, not a generic "thank you."
- Give clear, concrete next steps for actually getting access (where to check email, what the receipt/access email will be titled so they can find it, how soon access arrives).
- Reaffirm the guarantee if one was supplied, briefly — this reduces buyer's remorse in the first few minutes after purchase, which is exactly when this page is seen.
- Restate the top 2-3 outcomes they just bought their way into, so the page still sells the transformation even though the sale is done.
- If bonuses were part of the offer, list them here as "included in your purchase" so nothing gets missed.`,
  tripwire: `This CTA was a TRIPWIRE purchase — a low-ticket entry offer whose real job is to lead straight into a bigger offer right now, while buying intent is highest. This page must do BOTH jobs:
- Briefly confirm the tripwire purchase (what they bought, that it's confirmed) — keep this part short, 2-3 sentences max.
- Then pivot immediately into a genuine ONE-TIME UPSELL section for the next offer up their ladder: its own headline, the specific outcome it adds on top of what they just bought, and a clear reason this is offered only right now on this page (e.g. a one-time price or bonus) — build a real CTA button for it.
- Make the upsell section visually the dominant part of the page (the tripwire confirmation should read like a receipt; the upsell should read like a mini sales page section) since that's where the actual next decision is made.
- Include a plain, low-pressure "no thanks, just take me to my purchase" link/button so declining is easy and honest, not a dark-pattern dead end.`,
  webinar_registration: `This CTA was to REGISTER for a webinar/challenge. Build the page around confirming that registration and getting them to actually show up:
- Confirm registration clearly and restate the exact date/time (use a placeholder like "[DATE/TIME]" for the member to fill in — do not invent a specific date).
- Give 2-3 concrete reasons to actually attend live rather than skip it (e.g. a live-only bonus, Q&A, first-come access) — attendance, not just registration, is the real goal of this page.
- Tell them what to do right now to make sure they show up (add to calendar, a reminder they'll receive, where the link will be sent).
- Restate the core promise/transformation briefly to keep momentum between registering and attending — not a full re-pitch, just enough to keep it top of mind.`,
};

const FALLBACK_INSTRUCTIONS = `No funnel type was specified for this project. Write a solid, generic-but-warm thank-you/confirmation page: confirm the action was received, restate the core promise briefly, and give one clear "what happens next" step. Keep it short rather than guessing at specifics that weren't provided.`;

export function buildThankYouPagePrompt(project: Project, priorGenerations: PriorGeneration[] = []): string {
  const funnelType = project.funnel_type as FunnelType | "";
  const funnelInstructions = funnelType && funnelType in FUNNEL_INSTRUCTIONS ? FUNNEL_INSTRUCTIONS[funnelType] : FALLBACK_INSTRUCTIONS;

  return `Build a complete, real, ready-to-use THANK YOU / confirmation page for the project below — the page someone lands on immediately after taking the primary action (booking, buying, or registering). This is NOT a landing page and NOT a sales page — its job is to confirm what just happened and set up what happens next, using the exact copy and transformation language already established for this project (see prior assets below if any exist).

${formatDiscoveryBlock(project)}
${formatPriorGenerationsBlock(priorGenerations)}

FUNNEL TYPE FOR THIS PAGE — this determines what the page must actually say, read carefully:
${funnelInstructions}

OUTPUT FORMAT — read carefully, this overrides the general formatting rules in your system prompt:
Output ONLY a single, complete, self-contained HTML document — starting with <!doctype html> and ending with </html>. No markdown, no commentary, no code fence, nothing before or after it.

Build these sections, in order, as real HTML/CSS (not placeholders or descriptions of what should go there):

1. **Confirmation header** — a large, warm confirmation headline (NOT a generic "Thank You" — make it specific to what just happened and the transformation ahead) plus one supporting line.
2. **What happens next** — the funnel-specific body from the instructions above, built out as real, finished copy addressed directly to the person who just took the action.
3. **Reinforcement** — a short section restating the core promise/outcome briefly, so the page still feels like forward momentum rather than a dead end.
4. **Footer** — business name and a copyright line with the current year.

Design requirements — this must NOT look bland, generic, or like an unstyled wireframe:
- Fully self-contained: all CSS inline in a single <style> block in <head>. No external stylesheets, fonts, scripts, images, or CDN links of any kind — use a system font stack (e.g. -apple-system, "Segoe UI", Roboto, sans-serif).
- ${CSS_VAR_DESIGN_BLOCK}
- Real, modern, mobile-responsive design with at least one media query for phone-width screens.
- This page is intentionally shorter and calmer than a landing page — no opt-in form, no bullet-heavy benefits wall, no FAQ. It's a confirmation, not a pitch (except for the tripwire upsell case above, where the upsell section is deliberately the exception).
- No lorem ipsum and no placeholder brackets beyond the one explicitly allowed date/time placeholder for webinar registrations — every other word of copy must be the real, finished copy for this specific offer.`;
}
