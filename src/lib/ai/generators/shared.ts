import type { AssetType, Project } from "@/types/database";
import { getFunnelTypeLabel } from "@/lib/funnelType";

// Best-effort — strips everything but digits and a decimal point ("$1,997" -> 1997, "$297/mo"
// -> 297). Returns null for anything that doesn't parse to a real positive number rather than
// guessing, since a wrong number in a sum is worse than one missing line in it. Exported so
// DiscoveryForm's Value Stack editor can show the member the exact same running total the
// generator prompt actually sees, instead of two slightly different pieces of arithmetic.
export function parseMoney(value: string): number | null {
  const n = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// The Value Stack block (see 0045_value_stack.sql, 0046_bonus_category_and_fab.sql) — core offer
// value + each stack/bonus item's own value, summed into a real total the generator doesn't have
// to guess at. Separate from formatDiscoveryBlock's own field() helper below since this needs
// real arithmetic, not just a blank-vs-filled check. Returns "" when nothing here is actually
// filled in, so a project that hasn't used this yet doesn't get a block of all-blank lines.
//
// Stack items and bonuses are listed under their own labels — a core component of the offer
// itself reads differently when revealed ("included in the program") than a separate extra gift
// ("and I'll also throw in...") — but both still count toward the one combined total. A missing
// `category` (every item saved before this distinction existed) defaults to "stack".
function formatValueStackBlock(project: Project): string {
  const coreValue = project.core_offer_value?.trim() ? parseMoney(project.core_offer_value) : null;
  const allItems = (project.stack_items ?? []).filter((item) => item.name?.trim() || item.value?.trim());
  if (!project.core_offer_value?.trim() && allItems.length === 0) return "";

  const stackItems = allItems.filter((item) => item.category !== "bonus");
  const bonusItems = allItems.filter((item) => item.category === "bonus");

  const lines = [
    "",
    "VALUE STACK — build the offer reveal from these EXACT items, progressively (batched cumulative recaps, never all at once and never one item per beat — see this generator's own rules for pacing):",
    `Core offer value: ${project.core_offer_value?.trim() || "(not provided)"}`,
  ];
  let total = coreValue ?? 0;
  for (const item of stackItems) {
    lines.push(`Stack item (part of the core offer): ${item.name?.trim() || "(unnamed)"} — ${item.value?.trim() || "(no value given)"}`);
    const v = item.value?.trim() ? parseMoney(item.value) : null;
    if (v) total += v;
  }
  for (const item of bonusItems) {
    lines.push(`Bonus (a separate extra, not part of the core offer): ${item.name?.trim() || "(unnamed)"} — ${item.value?.trim() || "(no value given)"}`);
    const v = item.value?.trim() ? parseMoney(item.value) : null;
    if (v) total += v;
  }
  if (total > 0) {
    lines.push(`TOTAL STACK VALUE (core + every stack item + every bonus above, computed): ${formatMoney(total)}`);
    const priceValue = parseMoney(project.price);
    if (priceValue) {
      const ratio = total / priceValue;
      lines.push(
        ratio >= 1.5
          ? `ACTUAL PRICE vs. TOTAL VALUE: the price (${project.price.trim()}) is about ${ratio.toFixed(1)}x less than the total stack value above — state this gap explicitly and dramatically when revealing the price (the classic "all of this is worth ${formatMoney(total)}... but not today — today it's just ${project.price.trim()}" moment).`
          : `ACTUAL PRICE vs. TOTAL VALUE: the price (${project.price.trim()}) is NOT meaningfully smaller than the total stack value (${formatMoney(total)}) — this undercuts the reveal; the price should read as a small fraction of the total, not close to it. Still use the real numbers given, but don't invent extra drama the math doesn't support.`
      );
    }
  }
  return lines.join("\n");
}

// The Fast Action Bonus block (see 0046_bonus_category_and_fab.sql) — a bonus reserved for
// whoever acts fastest (the qualifying condition is what makes it "fast action," not just another
// bonus). Deliberately separate from formatValueStackBlock above: this is revealed AFTER the
// price, tied to urgency/scarcity (Phase 7's territory), never folded into the Value Stack's own
// pre-price reveal. Returns "" when none were given.
function formatFastActionBonusBlock(project: Project): string {
  const items = (project.fast_action_bonuses ?? []).filter(
    (item) => item.name?.trim() || item.value?.trim() || item.condition?.trim()
  );
  if (items.length === 0) return "";

  const lines = [
    "",
    "FAST ACTION BONUS(ES) — place these exactly where this asset's own sequencing rules say, tied to acting right now; never fold them into the Value Stack's own items/total, and never attach a price or price-change fact to them before the price has been revealed:",
  ];
  for (const item of items) {
    lines.push(
      `${item.name?.trim() || "(unnamed)"} — ${item.value?.trim() || "(no value given)"} — reserved for: ${item.condition?.trim() || "(no qualifying condition given — don't invent one, ask the member to add it)"}`
    );
  }
  return lines.join("\n");
}

// Renders a Project's full discovery brief into the block every generator prompt is built on.
// Centralized so "discovery-before-copy" is enforced consistently — every generator sees
// exactly the same facts, and missing fields are explicit rather than silently blank.
// Grouped to match the Discovery -> Customer Awareness -> Positioning -> Value Proposition ->
// Offer sequence the Pitch Perfect playbooks require before writing any copy.
export function formatDiscoveryBlock(project: Project): string {
  const field = (label: string, value: string) =>
    `${label}: ${value?.trim() ? value.trim() : "(not provided)"}`;

  return [
    `PROJECT: ${project.name}`,
    "",
    "DISCOVERY",
    field("Business / brand name", project.business_name),
    field("Industry / niche", project.industry),
    field("Product or service", project.product),
    field("Core offer name (the exact name of what's being sold)", project.offer_name),
    field("Target audience", project.audience),
    field("Existing marketing assets", project.existing_assets),
    "",
    "CUSTOMER AWARENESS",
    field("Awareness level", project.awareness_level),
    field("Biggest pain points", project.pain_points),
    field("False beliefs / objections", project.false_beliefs),
    field("Desired transformation", project.desired_transformation),
    "",
    "POSITIONING",
    field("Market category", project.category),
    field("The enemy / villain", project.enemy),
    field("Primary differentiator", project.differentiator),
    field("Competitive alternatives", project.competitive_alternatives),
    "",
    "VALUE PROPOSITION",
    field("Unique mechanism", project.unique_mechanism),
    field("Core promise", project.core_promise),
    field("Top outcomes / benefits", project.outcomes),
    field("Proof available", project.proof),
    "",
    "OFFER",
    field("Core offer price (what's actually charged)", project.price),
    field("Guarantee", project.guarantee),
    field("Bonuses", project.bonuses),
    formatValueStackBlock(project),
    field("Scarcity / urgency", project.scarcity_urgency),
    "(Note on the line above: in any asset that reveals the price at a specific moment — webinar, VSL, challenge pitch — a price-rise or price-change fact in it (\"price rising to $X,\" \"this price won't last\") is PRICE information and may only be stated AFTER the real price has been revealed. Seat/spot/cohort-size limits aren't price information and can be used earlier, but never with a price or dollar figure attached.)",
    formatFastActionBonusBlock(project),
    field("Primary call to action", project.cta),
    field("Funnel type (what the CTA leads to)", getFunnelTypeLabel(project.funnel_type)),
    // Reported need: a close ending in "click the link below" or "the link is in the chat" has
    // nothing to click in a live or recorded presentation — there usually isn't an actual
    // clickable link on screen the way there would be under a YouTube video or email. When this
    // is filled in, every generator with a real call-to-action should say the exact URL out loud/
    // on-screen, not gesture at a link that may not exist in that format. Never invent one when
    // this is blank — fall back to the plain CTA text above instead ("go book your call now").
    project.cta_url?.trim()
      ? `CTA link (the real URL to send people to — state this EXACT link directly in the call-to-action, e.g. "go to ${project.cta_url.trim()} right now"): ${project.cta_url.trim()}${
          project.funnel_type === "webinar_registration"
            ? " — note: this project's funnel type is webinar/challenge registration, which is a DIFFERENT, earlier link (how people got INTO this webinar/challenge) than this one. This CTA link is specifically for the webinar/challenge's OWN closing pitch — whatever it actually asks people to do once they've decided to buy (a checkout, a booking page, etc.) — never confuse the two or state this link as if it were the registration step."
            : project.funnel_type === "tripwire"
              ? " — this is THIS tripwire offer's own checkout page specifically, not the bigger upsell that follows it (that upsell lives on the Thank You Page after this purchase, not in this presentation's own close)."
              : ""
        }`
      : "CTA link: (not provided — do not invent one; the call-to-action should use the plain CTA text above instead, with no specific URL stated)",
    "",
    // This used to render as just one more labeled field among ~24 others ("Additional discovery
    // notes: ..."), indistinguishable from customer-voice flavor text like pain points or
    // objections. A member reported adding a specific instruction here (a framework name to use,
    // something the course should cover) and having every generator — including a full
    // regenerate, which reads this same block fresh every time — simply not act on it. The facts
    // were present in the prompt the whole time; nothing told the model this particular field
    // carries instructions it must actually follow rather than background it can take or leave.
    // This explicit framing is what makes that real.
    "ADDITIONAL DISCOVERY NOTES — READ CAREFULLY: anything below is a direct instruction from the",
    "project owner (a specific framework or topic to include, an exact name to use, customer",
    "language to use verbatim, anything else). Incorporate it into the output below — it is not",
    "just background context, and if it conflicts with a generic instruction elsewhere in this",
    "prompt, what's written here wins.",
    project.discovery_notes?.trim() || "(none provided)",
  ].join("\n");
}

export interface PriorGeneration {
  assetType: AssetType;
  content: string;
}

// Long assets (a 60-90 slide PPT outline especially) would otherwise balloon every later
// generation's input cost just to carry context forward — this caps each one to its opening
// section, which is where the headline/hook/Big Idea actually live.
const PRIOR_GENERATION_CHAR_LIMIT = 4000;

function humanizeAssetType(assetType: AssetType): string {
  return assetType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Every asset for a project must share the same Big Idea, Unique Mechanism, headline/hook
// language, and offer framing as whatever else has already been generated for it, per the
// Campaign Architecture Operating Manual (09-campaign-architecture.md) — not reinvent its own
// narrative on every call. That rule is already in every generator's system prompt (it's part of
// the knowledge library buildSystemPrompt loads), but an instruction to "stay consistent with
// prior assets" does nothing if the model is never actually shown what those assets said — this
// is what makes it real. Returns "" when the project has no other completed generations yet
// (nothing to be consistent with on the very first asset).
export function formatPriorGenerationsBlock(priorGenerations: PriorGeneration[]): string {
  if (priorGenerations.length === 0) return "";

  const sections = priorGenerations.map(({ assetType, content }) => {
    const truncated =
      content.length > PRIOR_GENERATION_CHAR_LIMIT
        ? `${content.slice(0, PRIOR_GENERATION_CHAR_LIMIT)}\n[...truncated for length — the full asset is in this project's Version History]`
        : content;
    return `### ${humanizeAssetType(assetType)}\n${truncated}`;
  });

  return [
    "",
    "EXISTING ASSETS ALREADY GENERATED FOR THIS PROJECT",
    "Reuse and build on these — the same Big Idea, Unique Mechanism, headline/hook language, and offer framing — rather than inventing a different core narrative. This new asset should feel like the next step in the same story these assets already tell, not a fresh pitch that happens to share the same facts.",
    "",
    sections.join("\n\n"),
  ].join("\n");
}
