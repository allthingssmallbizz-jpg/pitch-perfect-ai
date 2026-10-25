import type { Project } from "@/types/database";
import { formatDiscoveryBlock, formatPriorGenerationsBlock, type PriorGeneration } from "./shared";
import { parsePptOutline } from "../pptxParser";

// Raised from 3 — the 60-90 slide requirement below roughly doubled real output-token spend
// per generation (see PPT_OUTLINE_MAX_OUTPUT_TOKENS), so the credit price members pay was
// bumped to match and keep this in line with the margin math.
export const PPT_OUTLINE_CREDIT_COST = 10;
// Raised from 3500, then 8000, then 16000 — a real test run at 8000 tokens still cut off
// mid-slide around slide 40 of the required 60-90 (roughly 200 tokens/slide in practice, so 90
// slides needs ~18,000), and 16000 itself still left many full-length decks needing at least one
// continuation call. Each continuation is a full extra request round-trip on top of an already
// multi-minute generation — real wall-clock time a member waits through live during a demo — so
// now that anthropic.ts streams every call (removing the response-timeout ceiling that kept this
// conservative), 24000 gives the great majority of decks enough room to finish in one shot
// instead of needing a second call at all. Still not unlimited: generateCompleteAsset
// automatically continues past this if a deck genuinely needs more room, exactly as before —
// this only shrinks how often that happens, never what a deck is allowed to contain.
export const PPT_OUTLINE_MAX_OUTPUT_TOKENS = 24000;

// A real generation came back with only 7-8 slides instead of the required 60-90 — Claude had
// stopped on its own (stop_reason "end_turn", not "max_tokens"), having compressed each phase of
// the arc into a single slide despite the prompt explicitly warning against exactly that. Since
// that's not a hard token cutoff, generateCompleteAsset's original continuation trigger
// (stop_reason === "max_tokens") never fired and the short result was saved as if it were
// complete. This threshold — well under the 60 floor, not right up against it — is what
// generateCompleteAsset checks instead: below it, force a continuation even on a natural stop;
// at or above it, trust Claude finished a real deck rather than chase the exact upper bound of a
// range that was always meant to flex with how much the discovery brief actually supports.
export const PPT_OUTLINE_MIN_ACCEPTABLE_SLIDES = 50;

export function isPptOutlineIncomplete(content: string): boolean {
  return parsePptOutline(content).length < PPT_OUTLINE_MIN_ACCEPTABLE_SLIDES;
}

export const PPT_OUTLINE_CONTINUATION_HINT =
  "You stopped short of the required 60-90 total slides — this deck is not done yet. Keep writing through the rest of the arc (remaining teaching points, transition, offer stack, guarantee, urgency, close/CTA) with the same slide-by-slide pacing as before: one slide per real beat, not one slide per phase.";

export function buildPptOutlinePrompt(project: Project, priorGenerations: PriorGeneration[] = []): string {
  return `Build a slide-by-slide PowerPoint outline (titles + speaker notes, not full design) for presenting this offer. Use PPWOS™ phases if this reads as a consumer webinar/pitch, or PPSOS™ (Capture Executive Attention → Build Business Relevance → Create New Business Beliefs → Build Executive Certainty → Present the Solution → Maximize Business Value → Drive Organizational Commitment) if the discovery notes indicate a B2B/enterprise/multi-stakeholder audience. If building the arc from discovery directly (no existing Webinar Outline to follow — see below), the Build Relevance phase still needs a real Epiphany Bridge™ story, the Create New Beliefs phase needs the full Three Secrets™ structure (Playbook 10): name the Big Domino™, then break it into Vehicle/Internal/External false beliefs, each broken by its own dedicated Epiphany Bridge story — same as a Webinar Outline would require, not a single shortcut belief/story — and the Maximize Value phase needs the full progressive Stack™ reveal described below, not a single slide listing everything at once.

${formatDiscoveryBlock(project)}
${formatPriorGenerationsBlock(priorGenerations)}

If a Webinar Outline already exists above for this project, build these slides directly from its phases and beats (same belief shift, same offer stack order, same real facts) rather than re-deriving the arc from discovery alone — this deck should be the visual version of that exact outline, not a different pass at the same facts. "Same order," not "same literal wording": if the outline's own beat is labeled with an internal planning term ("Core Offer Value," "Full Stack Reveal #1"), that label is still never the slide's actual title — write this deck's own real, audience-facing headline for it exactly per the title rule below, same as if there were no outline to copy from at all.

STACK & PRICE SEQUENCE — this is a required slide-pacing rule, on top of whatever the outline or discovery says about the offer.

HARD RULE: the price (no number, no "it costs," no monthly figure, no comparison price) must NOT appear anywhere — on-slide or in speaker notes — until AFTER the final full-stack anchor (step 7 below) AND the required value-justification question (step 8 below). Every piece of value, risk reversal, and proof is presented BEFORE the price is ever shown. The only things that come after the price are the price justification and the decision/close (step 10). The value stack itself must be revealed MULTIPLE times across the close, never just once — never a single slide (or single pass) that shows the core offer, every stack item/bonus, and the total only one time before moving on.

"No price" covers every kind of price information, not just today's number: before the price reveal (steps 1-8, on-slide AND in notes) never state or hint at what the offer costs, that the price will go up, rise, or change later, a future/regular/after-the-cohort price (e.g. "rising to $5,500"), "this price will never be the same," "this price won't last," or any dollar figure that is the offer's price, a payment amount, or a comparison price. Those are price facts — they can't be said about a price the audience hasn't seen yet, and they belong ONLY in step 10, after the real price is revealed (reported real failure: a slide before the price reveal said the price would never be the same and would rise to $5,500 after the cohort, referencing a $1,500 price nobody had seen yet). The discovery "Scarcity / urgency" field often mixes both kinds of facts ("10 founding seats, price rising to $5,500"): split it — the seat/spot/cohort-size/bonus-availability limits may run pre-price in steps 4/6 as pure limited-availability statements with no price or dollar figure in them, while every price-rise/price-change fact is held back for step 10. The only dollar figures allowed before the price reveal are the VALUE figures from the stack (item values and the total).

Build the offer section in this exact order, using the real items/values from the VALUE STACK discovery data above (never invent one that isn't there):
1. CORE OFFER VALUE — right after the core teaching ends, one slide presenting the core program by itself with its own standalone dollar value (if one was supplied). This is the first stack slide; no stack item or bonus exists yet.
2. INCREMENTAL BUILD — introduce each remaining stack item/bonus on its OWN slide, one single item per slide (never batching several items onto one slide). Immediately after each item's own introduction slide, add a second slide re-displaying the RUNNING stack so far: the core offer plus every item revealed up to and including this one, each with its own value, with the running cumulative total updated to match. This produces a pair of slides — introduce, then running recap — for every single item in the Value Stack data, not a handful of grouped recap slides. Word a stack item (part of the core offer) and a bonus (a separate extra) differently when introducing each.
3. FULL STACK REVEAL #1 — right after the final item's running-recap slide, one slide displaying the COMPLETE stack (every line item, from the core offer through the last bonus) together with the total value. Still no price.
4. VALUE/DERISK BLOCK (still no price) — the guarantee/risk reversal, scarcity (WHY this offer or its bonuses are actually limited — spots, cohort size, availability — never the price itself), and any transformation/"what changes for you" content that belongs here rather than earlier.
5. FULL STACK REVEAL #2 (callback) — a "So what exactly are you getting?" slide, re-displaying the complete stack and total again, the same way as #1. Still no price.
6. FAST ACTION BONUS (its real item, value, and qualifying condition from the discovery data when present — "and if you're one of the [condition], I'll also include [item], worth [value]" — never invented, never folded into the stack/total above) plus one to two more proof or story slides. Still no price.
7. FULL STACK REVEAL #3 (the final pre-price anchor) — immediately before the price slide, display the complete stack and total one final time. This is deliberate: the audience remembers the last full thing they saw right before the price, so this reveal can never be skipped or merged into the price slide itself. Still no price.
8. VALUE JUSTIFICATION QUESTION — required, its own dedicated slide, immediately after step 7 and immediately before the price slide, never skipped and never folded into either one. The question MUST be worded exactly this way, with the real total value from step 7 filled in — both on the slide and in the speaker notes: "Although I'm not going to charge you [total value] today, if I were to charge you that, would it be worth it?" Do not paraphrase it, soften it, or replace it with a different tie-down ("Everything I just showed you is worth... but if I did"); that exact "although I'm not going to charge you [value] today... if I were to charge you that, would it be worth it?" construction is the required wording — the classic tie-down question that gets the audience mentally agreeing to the value before the real price ever appears. A short lead-in naming the total ("Everything I've shown you adds up to [total value].") may come right before it, but the question itself stays word-for-word. This is a genuine question the slide/notes pose to the audience, not a rhetorical aside tucked into another slide — still no actual price (today's real number) anywhere on this slide.
9. PRICE REVEAL — only now. A slide showing the total value visually struck through / crossed out, dropping to the actual founding price.
10. PRICE JUSTIFICATION + DECISION CLOSE — everything from here on is about the price just shown and the decision itself: why this price won't last (it rises later / a real deadline, tied to the Fast Action Bonus's own qualifying condition when one exists), the required **Two Paths** slide (see below), objection handling, an emotional close, and the single specific CTA repeated 2-3 times. Every one of those CTA repeats states the real CTA link from Discovery above directly and literally when one was given ("go to [that exact link] right now to join") — never a vague "click the link below" with no actual link on screen, since there usually isn't one in this format. If no CTA link was given, use the plain CTA text instead and don't invent a URL.

How many FULL stack reveals (steps 3, 5, and 7 above) this close needs scales with the project's own price (the "Core offer price" field in Discovery above) — never generate a close where the complete stack appears only once:
- Under $2,000: 2 full reveals — build steps 3 and 7 only; skip step 5 and fold its VALUE/DERISK BLOCK content (step 4) and FAST ACTION BONUS content (step 6) together into one continuous pre-anchor stretch instead.
- $2,000–$5,000: 3 full reveals — build steps 3, 5, and 7 exactly as written above.
- Over $5,000: 4 full reveals — build steps 3, 5, and 7 as written, PLUS one more full stack-reveal slide (preceded by its own 1-2 proof/story slides) inserted between step 5 and step 7.
If the price can't be determined from Discovery, default to the $2,000–$5,000 tier (3 full reveals).

NEVER reveal the price before the final anchor (step 7) and the value justification question (step 8) — NEVER skip the value justification question or fold it into step 7 or step 9. NEVER leave the guarantee, bonuses, or scarcity sitting in slides AFTER the price — they belong in steps 4/6, before it. NEVER generate a close where the stack appears only once.

"Stack," "stack item," "bonus," "full stack reveal," "incremental build," and "running stack" above are internal planning names for THIS PROMPT's own beats — never words the audience is meant to see or hear. The whole point of the stack as a sales technique is that the audience experiences it as a presenter generously piling on value, never as a labeled mechanic being run on them — telling them what you're doing breaks it completely. So: never title or bullet a slide "Stack Item," "Here's Your Stack So Far," "Full Stack Reveal," "Watch the Numbers Climb," or anything else that names the mechanic itself — including narrating that a number/value/total is increasing, growing, climbing, or stacking up, which is just as much a reveal of the mechanic as naming it outright.
- The core-offer slide and each item's own introduction slide (steps 1-2) are titled with the actual thing being named (the program's real name, or the bonus's real name/a benefit headline for it) — e.g. "Pitch Perfect AI Platinum Unlimited" or "And Here's What Else You're Getting: [Bonus Name]," never "Stack Item: [Name]."
- Every running-recap and full-stack-reveal slide (steps 2's recap, 3, 5, 7) is titled the way a presenter would actually introduce a value recap out loud — "Here's Everything You're Walking Away With Tonight," "Let's Add It All Up," "So Here's Where We're At," "Here's What You're Getting Right Now" — never "Your Running Stack," "Here's Your Stack So Far," or "Full Stack Reveal."
- GENERAL PRINCIPLE, not just a list of banned phrases (a banned-phrase list always misses the next way of saying the same thing — "Watch the Numbers Climb," "Watch This Number Climb," "See the Value Grow," "Watch the Total Rise," "Let's Add This One Too," "Here's One More to Add," and any other wording all fail the SAME way): a stack/recap slide's title must never comment on the ACT of building, adding, revealing, or accumulating value itself — never treat the accumulation, the counting, or the growing total as the subject of the title. The subject of the title is always either the actual item/value being shown on THIS slide, or the complete current picture (what's included, where things stand) — never the motion of it growing or the act of adding to it. Before finalizing any stack/recap title, check it against this test: does this title talk about VALUE, or does it talk about the PROCESS of revealing value? If it's the process, rewrite it to state the value itself instead.

Required, dedicated **Two Paths** slide (part of step 10 above, before the final CTA slide(s)) — never skipped, never folded into the guarantee or CTA slide. It lays out two explicit paths forward: path one, take everything just taught and go try to implement it alone (a genuinely valid choice, they have what they need to attempt it); path two, work with the presenter/the presenter's team instead, who has already walked this exact path and knows the real blueprint, putting them in the strongest position to actually get the result faster and with less trial and error. This is a distinct beat from the guarantee (risk removal, already revealed pre-price in step 4) and urgency (reason to act fast) — its whole job is giving explicit permission via a real choice, in this project's own voice, not restating either of those.

Output ONLY real slides — "**Slide #: Title**" followed by that slide's own content — never a standalone section-divider line sitting between two slides outside that structure ("PHASE 3 — CREATE NEW BELIEFS (Slides 15-40)," "Secret #1 — The Vehicle: ..."). Reported real failure: a deck with exactly these divider lines caused Read Aloud's practice mode to read them aloud, out loud, right before the next slide's actual title — an internal planning label landing as a jarring non-sequitur, over and over through the deck. Whatever phase/secret a slide belongs to must be conveyed ENTIRELY through that slide's own real title and content, never through a separate organizational label line floating outside any slide.

For each slide output:
- **Slide #: Title** — THE GENERAL RULE, before any examples below, and it governs EVERY slide in this deck start to finish, every phase, with zero exceptions: a title must always name the ACTUAL thing being said or shown on that specific slide — a real headline, claim, story moment, question, or result — and must NEVER name the ROLE that slide plays in any teaching/sales/persuasion framework, whether that framework is named anywhere in this prompt or not. Run this exact test on every single title before moving to the next slide: "does this title describe WHAT'S being said here, or WHICH STAGE of some methodology this is?" If it's the stage, it fails, full stop, regardless of which phase of the deck it's in or which framework the term happens to come from.
  This is not a short list of banned words to avoid — it is a rule that must be freshly re-applied, phase by phase, slide by slide, because every phase of this deck has its OWN internal planning vocabulary and EVERY one of those vocabularies is equally off-limits as a literal title:
  - Opening/agenda phases: never "Big Promise," "Capture Attention," "Credibility Bridge," "Agenda," "Pattern Interrupt" — title with the real promise, the real topics, the presenter's real name/angle instead.
  - Offer/stack phases (see STACK & PRICE SEQUENCE above for the full rule): never "Stack Item," "Full Stack Reveal," "Here's Your Stack So Far," and never a title that narrates the mechanic of value accumulating either ("Watch the Numbers Climb," "Let's Add This One Too") — title with the real item's name or the real current picture of what's included instead.
  - Belief-shift/teaching phase (Phase 3): never "Foundation," "False Belief," "Reframe," "Rhythm," "Vehicle Belief," "Secret #1," "Belief Shift," or any other shorthand for Big Domino™/Three Secrets™/Vehicle-Internal-External/Epiphany Bridge™ — title with the real objection in the audience's own words, or the real story moment on screen, instead.
  - Proof phase (Phase 4): never "Case Study," "Case Study: Before," "Case Study: The Shift," "Case Study: The Results," "Testimonial," or similar — title with the actual client/result ("How Sarah Went From $0 to $10K/Month in 90 Days") or the real specific claim being proven, instead.
  - Offer-introduction/future-pacing phase (Phase 5): never "Future Pace," "Future Pace: 90 Days In," "Future Pace: Beyond 90 Days," or similar — title with the actual future moment being painted ("Picture This 90 Days From Now") instead.
  - Any OTHER phase, technique, or structural stage anywhere in this prompt, or from any methodology you know of that isn't named here at all: same rule, no exceptions, ever.
  Reported real failures this must never repeat: a deck titling four consecutive slides "Case Study: Before," "Case Study: The Shift," "Case Study: The Results" (Phase 4), and three more "Future Pace," "Future Pace: 90 Days In," "Future Pace: Beyond 90 Days" (Phase 5) — both read like a table of contents for the methodology, not a presentation, the exact same failure as "Big Promise" or "Foundation" above just in a different phase. The title still has to clearly match and set up the slide's own bullets below it — never so clever it goes vague or loses the point — just never a bare restatement of the framework term for what this slide's JOB is.
- **On-slide content**: 2-4 bullets, EVERY one a complete, specific, substantive point — a real claim, number, benefit, or insight a viewer could read on its own and understand, not a bare fragment or vague label. "Turn 20 years of industry knowledge into a $10K/month coaching offer" is a real bullet; "Our Solution" or "Knowledge → Income" is not — it forces the audience to guess what you mean instead of landing the point. A new presenter reading only what's on screen (no narration at all) should still walk away understanding the point of that slide. Still a deck, not a document: each bullet is one tight, complete phrase or short sentence — not a paragraph, and never the actual spoken script.
- **Speaker notes**: 1-3 concise sentences — what the presenter actually SAYS out loud while this slide is up. This is for the presenter's eyes only; it must never repeat, duplicate, or expand into the on-slide bullets above, and the on-slide bullets must never be a shortened copy of the speaker notes. Keep the two doing genuinely different jobs: bullets are what the audience reads, notes are what the presenter says — related, but not the same words twice. This is also what members rehearse the whole talk from by listening to title + notes end to end, so it must NEVER reference its own place in the deck OR in the underlying PPWOS/PPSOS structure — never "slide 13," "slide 13 through 14," "on this slide," "moving to the next slide," "Phase 1," "Phase 6," "stack item," or "now for the next item in the stack," or anything similar. A real presenter delivers the actual content directly; they never narrate the deck's own structure, the internal framework phase it maps to, or the sales mechanic being used, out loud.
  ONE EXCEPTION to "never duplicate the bullets": on every slide in the STACK & PRICE SEQUENCE above (the core-offer slide, every item-introduction slide, every running-recap slide, every full-stack reveal, the price reveal itself), the notes MUST say the actual item name(s) and value(s) out loud — a real presenter reveals a stack verbally, by actually naming what's being added and what it's worth, not by silently gesturing at bullets on a screen while saying something generic. Reported real failure: notes that stay content-free filler ("and here's another great addition for you tonight!") while the real item/value sits only in the bullets — rehearsing from title + notes alone, a presenter would hit this slide and have nothing to actually say about what's being revealed. This is the one place "don't duplicate the bullets" gives way to "the audience needs to actually hear this" — phrase it the way a presenter would say it out loud ("And I'm also including [item], worth [value], completely free"), not a verbatim bullet readout, but the real name and number must be IN the notes, not just on screen.

This needs to be a full-length, effective webinar deck, not a summary outline: produce **60-90 slides** (err toward 75+ when the discovery brief supports it). Break every phase of the arc — opener/hook, credibility, each teaching point, transition, offer stack, guarantee, urgency, close/CTA — into real slide-by-slide pacing instead of compressing a phase into one or two slides. A slide with only one bare bullet, or a bullet that's just a topic label, is a failure to fix — every slide earns its place with real content, not a placeholder. Keep the deck non-repetitive across its full length (each slide's specific claim, not the same point restated) so the length comes from genuinely thorough pacing across the whole arc, not padding.`;
}

// Reported pattern, repeatedly, across several different projects/niches: a deck titles a run of
// slides with an internal methodology/framework stage name instead of real content (first
// "Stack Item"/"Full Stack Reveal", then "Foundation"/"False Belief"/"Reframe"/"Rhythm", then
// "Case Study: Before"/"The Shift"/"The Results" and "Future Pace: 90 Days In"/"Beyond 90 Days").
// No prompt wording can promise this never happens again for a niche/phrasing we haven't seen
// yet — this is a best-effort, heuristic SAFETY NET on top of the prompt rule above, not a
// replacement for it, meant to be surfaced to a member as a pre-flight check before they present a
// deck live rather than relying on them to notice it themselves mid-presentation. Two signals,
// since neither alone covers every real case we've already hit:
// 1. A short title containing one of the exact terms already reported as a real failure.
// 2. A short "Label: specific thing" title whose LABEL repeats verbatim across 2+ different
//    slides — every real failure above (Stack Item, Case Study, Future Pace) had this exact
//    shape, which is a structural signature independent of which specific words are used, so this
//    has a real chance of catching a brand-new term in a niche we haven't seen yet, unlike #1.
const KNOWN_STRUCTURAL_TITLE_TERMS = [
  "big promise",
  "capture attention",
  "credibility bridge",
  "pattern interrupt",
  "stack item",
  "full stack reveal",
  "running stack",
  "false belief",
  "belief shift",
  "vehicle belief",
  "epiphany bridge",
  "big domino",
  "three secrets",
  "case study",
  "future pace",
];

export type TitleLeakFlag = { slideNumber: number; title: string; reason: string };

export function findStructuralTitleLeaks(content: string): TitleLeakFlag[] {
  const slides = parsePptOutline(content);
  const flags: TitleLeakFlag[] = [];
  const flaggedSlideNumbers = new Set<number>();

  for (const slide of slides) {
    const normalized = slide.title.toLowerCase();
    const term = KNOWN_STRUCTURAL_TITLE_TERMS.find((t) => normalized.includes(t));
    if (term) {
      flags.push({
        slideNumber: slide.number,
        title: slide.title,
        reason: `Contains "${term}" — a known internal framework term, not real slide content.`,
      });
      flaggedSlideNumbers.add(slide.number);
    }
  }

  const labelGroups = new Map<string, { number: number; title: string }[]>();
  for (const slide of slides) {
    const match = slide.title.match(/^([^:]{2,30}):\s*\S.*/);
    if (!match) continue;
    const label = match[1].trim();
    if (label.split(/\s+/).length > 4) continue;
    const group = labelGroups.get(label.toLowerCase()) ?? [];
    group.push({ number: slide.number, title: slide.title });
    labelGroups.set(label.toLowerCase(), group);
  }
  for (const group of labelGroups.values()) {
    if (group.length < 2) continue;
    for (const slide of group) {
      if (flaggedSlideNumbers.has(slide.number)) continue;
      flags.push({
        slideNumber: slide.number,
        title: slide.title,
        reason: `Shares its "${slide.title.split(":")[0].trim()}" label with ${group.length - 1} other slide(s) — looks like a repeated framework-stage label rather than this slide's own real content.`,
      });
      flaggedSlideNumbers.add(slide.number);
    }
  }

  return flags.sort((a, b) => a.slideNumber - b.slideNumber);
}

// Companion pre-flight check to findStructuralTitleLeaks: reported real failure — a slide BEFORE
// the price reveal said the price would never be the same and would rise to $5,500 after the
// cohort, referencing a price the audience hadn't seen yet. The prompt rules forbid this, but
// like the title rule it's a best-effort instruction, so this is the code-level backstop. Needs a
// reliable "this is where the price is about to be revealed" anchor: the required Value
// Justification Question slide ("...would it be worth it?") sits right before the price slide, so
// everything up to and including it is pre-price. If no such slide exists the check can't tell
// where the price reveal is, and says so instead of guessing.
const PRICE_FACT_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /never be the same/i, label: "\"never be the same\"" },
  { pattern: /price[^.!?\n]{0,40}\b(go(?:es|ing)? up|rise[sn]?|rising|increase[sd]?|increasing|jump(?:s|ing)?|doubl(?:e|es|ing)|climb(?:s|ing)?)\b/i, label: "a price going up" },
  { pattern: /(?:price|cost|investment)[^.!?\n]{0,30}(?:won'?t|will not|isn'?t going to|is not going to) (?:last|stay)/i, label: "\"the price won't last\"" },
  { pattern: /\b(?:go(?:es|ing)? up|rise[sn]?|rising|increase[sd]?|jump(?:s|ing)?|moves? up|back up)\s+(?:to|by)\s+\$\s?\d/i, label: "a price rising to a dollar figure" },
  { pattern: /\bafter (?:the|this) (?:cohort|challenge|launch|webinar|founding|enrollment|enrolment)[^.!?\n]{0,60}\$\s?\d/i, label: "an after-the-cohort dollar figure" },
  { pattern: /\b(?:regular|normal|full|future|later|eventual|going) price\b/i, label: "a regular/future price" },
  { pattern: /\bprice (?:increase|hike)\b/i, label: "a price increase" },
  { pattern: /\b(?:costs?|priced at|payments? of|pay(?:ing)? just|only pay)\b[^.!?\n]{0,20}\$\s?\d/i, label: "what the offer costs" },
];

export function findPrePriceLeaks(content: string): TitleLeakFlag[] {
  const slides = parsePptOutline(content);
  const slideText = (s: (typeof slides)[number]) => [s.title, ...s.bullets, s.notes].join("\n");

  const exact = slides.findIndex((s) => /although i'?m not going to charge you/i.test(slideText(s)));
  const loose = slides.map((s, i) => (/would it be worth it/i.test(slideText(s)) ? i : -1)).filter((i) => i >= 0);
  const anchor = exact >= 0 ? exact : loose.length ? loose[loose.length - 1] : -1;

  if (anchor < 0) {
    return [
      {
        slideNumber: 0,
        title: "Whole deck",
        reason:
          "No \"would it be worth it?\" question slide was found right before the price reveal, so this check can't tell where the price is revealed or which slides count as pre-price. Add that slide (see Add, remove, or change something), then run this again.",
      },
    ];
  }

  const flags: TitleLeakFlag[] = [];
  for (const slide of slides.slice(0, anchor + 1)) {
    const text = slideText(slide);
    for (const { pattern, label } of PRICE_FACT_PATTERNS) {
      if (pattern.test(text)) {
        flags.push({
          slideNumber: slide.number,
          title: slide.title,
          reason: `Appears before the price is revealed but mentions ${label} — price information can only be stated after the real price has been shown.`,
        });
        break;
      }
    }
  }
  return flags;
}
