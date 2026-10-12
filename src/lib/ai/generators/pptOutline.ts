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

If a Webinar Outline already exists above for this project, build these slides directly from its phases and beats (same headline, same belief shift, same offer stack order) rather than re-deriving the arc from discovery alone — this deck should be the visual version of that exact outline, not a different pass at the same facts.

THE STACK REVEAL — this is a required slide-pacing rule, on top of whatever the outline or discovery says about the offer. The value stack must be revealed MULTIPLE times across the close, never just once — never a single slide (or single pass) that shows the core offer, every stack item/bonus, and the total only one time before moving on. Build the offer section in this exact order, using the real items/values from the VALUE STACK discovery data above (never invent one that isn't there):
1. CORE OFFER VALUE — right after the core teaching ends, one slide presenting the core program by itself with its own standalone dollar value (if one was supplied). This is the first stack slide; no stack item or bonus exists yet.
2. INCREMENTAL BUILD — introduce each remaining stack item/bonus on its OWN slide, one single item per slide (never batching several items onto one slide). Immediately after each item's own introduction slide, add a second slide re-displaying the RUNNING stack so far: the core offer plus every item revealed up to and including this one, each with its own value, with the running cumulative total updated to match. This produces a pair of slides — introduce, then running recap — for every single item in the Value Stack data, not a handful of grouped recap slides. Word a stack item (part of the core offer) and a bonus (a separate extra) differently when introducing each.
3. FULL STACK REVEAL #1 — right after the final item's running-recap slide, one slide displaying the COMPLETE stack (every line item, from the core offer through the last bonus) together with the total value.
4. One to two teaching or proof slides (real content grounded in this project's discovery/proof, not filler added just to create a gap).
5. FULL STACK REVEAL #2 — a "So what exactly are you getting?" slide, re-displaying the complete stack and total again, the same way as #1.
6. One to two more teaching, story, or objection-handling slides.
7. FULL STACK REVEAL #3 (the pre-price anchor) — immediately before the price slide, display the complete stack and total one final time. This is deliberate: the audience remembers the last full thing they saw right before the price, so this reveal can never be skipped or merged into the price slide itself.
8. PRICE REVEAL — a slide showing the total value visually struck through / crossed out, dropping to the actual price.

How many FULL stack reveals (steps 3, 5, and 7 above) this close needs scales with the project's own price (the "Core offer price" field in Discovery above) — never generate a close where the complete stack appears only once:
- Under $2,000: 2 full reveals — build steps 3 and 7 only; skip step 5 and its surrounding teaching/proof slides entirely.
- $2,000–$5,000: 3 full reveals — build steps 3, 5, and 7 exactly as written above.
- Over $5,000: 4 full reveals — build steps 3, 5, and 7 as written, PLUS one more full stack-reveal slide (preceded by its own 1-2 teaching/proof slides) inserted between step 5 and step 7.
If the price can't be determined from Discovery, default to the $2,000–$5,000 tier (3 full reveals).

Right after the price slide, a separate slide revealing the FAST ACTION BONUS from the discovery data when present (its real item, value, and qualifying condition — "and if you're one of the [condition], I'll also include [item], worth [value]") — this is never part of the stack/total above, and never appears before the price.

Somewhere after guarantee/urgency, right before the final CTA slide(s): a required, dedicated **Two Paths** slide — never skipped, never folded into the guarantee or CTA slide. It lays out two explicit paths forward: path one, take everything just taught and go try to implement it alone (a genuinely valid choice, they have what they need to attempt it); path two, work with the presenter/the presenter's team instead, who has already walked this exact path and knows the real blueprint, putting them in the strongest position to actually get the result faster and with less trial and error. This is a distinct beat from the guarantee (risk removal) and urgency (reason to act fast) slides — its whole job is giving explicit permission via a real choice, in this project's own voice, not restating either of those.

For each slide output:
- **Slide #: Title** — a real, specific, compelling headline that reflects what's actually ON this slide, written the way an audience would actually read a slide title — NEVER the name of the underlying phase/framework/playbook beat itself. A viewer watching should never be able to tell which internal structural label (Big Promise, Capture Attention, Credibility Bridge, Agenda, Pattern Interrupt, etc.) a slide maps to just by reading its title — that's internal planning language, not something that belongs on screen. "The Big Promise" as a literal title is a failure to fix; "Here's Exactly What You'll Walk Away With Tonight" (or whatever this project's ACTUAL promised outcome specifically is) is the kind of title to write instead. Same for an agenda slide ("Tonight's Agenda" → something naming the actual topics/arc ahead), a check-in slide ("Quick Check-In" → something earning the engagement, not labeling the mechanic), or a credibility slide ("Who's Running This?" → the presenter's actual name/angle, not the beat's name). The title still has to clearly match and set up the slide's own bullets below it — never so clever it goes vague or loses the point — just never a bare restatement of the framework term for what this slide's JOB is.
- **On-slide content**: 2-4 bullets, EVERY one a complete, specific, substantive point — a real claim, number, benefit, or insight a viewer could read on its own and understand, not a bare fragment or vague label. "Turn 20 years of industry knowledge into a $10K/month coaching offer" is a real bullet; "Our Solution" or "Knowledge → Income" is not — it forces the audience to guess what you mean instead of landing the point. A new presenter reading only what's on screen (no narration at all) should still walk away understanding the point of that slide. Still a deck, not a document: each bullet is one tight, complete phrase or short sentence — not a paragraph, and never the actual spoken script.
- **Speaker notes**: 1-3 concise sentences — what the presenter actually SAYS out loud while this slide is up. This is for the presenter's eyes only; it must never repeat, duplicate, or expand into the on-slide bullets above, and the on-slide bullets must never be a shortened copy of the speaker notes. Keep the two doing genuinely different jobs: bullets are what the audience reads, notes are what the presenter says — related, but not the same words twice.

This needs to be a full-length, effective webinar deck, not a summary outline: produce **60-90 slides** (err toward 75+ when the discovery brief supports it). Break every phase of the arc — opener/hook, credibility, each teaching point, transition, offer stack, guarantee, urgency, close/CTA — into real slide-by-slide pacing instead of compressing a phase into one or two slides. A slide with only one bare bullet, or a bullet that's just a topic label, is a failure to fix — every slide earns its place with real content, not a placeholder. Keep the deck non-repetitive across its full length (each slide's specific claim, not the same point restated) so the length comes from genuinely thorough pacing across the whole arc, not padding.`;
}
