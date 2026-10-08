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

THE STACK REVEAL — this is a slide-pacing rule, on top of whatever the outline or discovery says about the offer. Never one slide that shows the core offer, every stack item/bonus, the total, and the price all at once — but also never one slide PER individual item, which turns into far too many slides when there are several. Instead, build it as a batched, CUMULATIVE recap:
1. A slide introducing the core offer alone, with its own value if one was supplied — before any stack item or bonus exists yet.
2. Count how many stack items + bonuses the VALUE STACK discovery data actually has, then group them into batches of roughly 2-3 each. How many "stack recap" slides follow depends on that real count (3 items → one recap slide; 9 items → three recap slides; 10 items → maybe 3+3+4) — don't force a fixed number of slides regardless of how many items actually exist. Word a stack item (part of the core offer) and a bonus (a separate extra) differently when introducing each, even within the same batch.
3. Each stack-recap slide shows the FULL cumulative stack built so far, not just what's new in that batch: the core offer + every item from every earlier batch + this batch's new items, each with its own value, all together as one growing on-screen list. The second recap slide repeats everything the first one showed AND adds the next batch; the third repeats everything the first two showed AND adds its own batch. The visible effect is the stack physically growing slide to slide, not a series of unrelated one-off reveals.
4. A final slide totaling literally everything just stacked (the real number from the discovery data when one was computed — never invent one).
5. A slide revealing the price, visually/verbally contrasted against that total.
6. Right after the price slide, a separate slide revealing the FAST ACTION BONUS from the discovery data when present (its real item, value, and qualifying condition — "and if you're one of the [condition], I'll also include [item], worth [value]") — this is never part of the stack/total above, and never appears before the price.

For each slide output:
- **Slide #: Title** — a real, specific, compelling headline that reflects what's actually ON this slide, written the way an audience would actually read a slide title — NEVER the name of the underlying phase/framework/playbook beat itself. A viewer watching should never be able to tell which internal structural label (Big Promise, Capture Attention, Credibility Bridge, Agenda, Pattern Interrupt, etc.) a slide maps to just by reading its title — that's internal planning language, not something that belongs on screen. "The Big Promise" as a literal title is a failure to fix; "Here's Exactly What You'll Walk Away With Tonight" (or whatever this project's ACTUAL promised outcome specifically is) is the kind of title to write instead. Same for an agenda slide ("Tonight's Agenda" → something naming the actual topics/arc ahead), a check-in slide ("Quick Check-In" → something earning the engagement, not labeling the mechanic), or a credibility slide ("Who's Running This?" → the presenter's actual name/angle, not the beat's name). The title still has to clearly match and set up the slide's own bullets below it — never so clever it goes vague or loses the point — just never a bare restatement of the framework term for what this slide's JOB is.
- **On-slide content**: 2-4 bullets, EVERY one a complete, specific, substantive point — a real claim, number, benefit, or insight a viewer could read on its own and understand, not a bare fragment or vague label. "Turn 20 years of industry knowledge into a $10K/month coaching offer" is a real bullet; "Our Solution" or "Knowledge → Income" is not — it forces the audience to guess what you mean instead of landing the point. A new presenter reading only what's on screen (no narration at all) should still walk away understanding the point of that slide. Still a deck, not a document: each bullet is one tight, complete phrase or short sentence — not a paragraph, and never the actual spoken script.
- **Speaker notes**: 1-3 concise sentences — what the presenter actually SAYS out loud while this slide is up. This is for the presenter's eyes only; it must never repeat, duplicate, or expand into the on-slide bullets above, and the on-slide bullets must never be a shortened copy of the speaker notes. Keep the two doing genuinely different jobs: bullets are what the audience reads, notes are what the presenter says — related, but not the same words twice.

This needs to be a full-length, effective webinar deck, not a summary outline: produce **60-90 slides** (err toward 75+ when the discovery brief supports it). Break every phase of the arc — opener/hook, credibility, each teaching point, transition, offer stack, guarantee, urgency, close/CTA — into real slide-by-slide pacing instead of compressing a phase into one or two slides. A slide with only one bare bullet, or a bullet that's just a topic label, is a failure to fix — every slide earns its place with real content, not a placeholder. Keep the deck non-repetitive across its full length (each slide's specific claim, not the same point restated) so the length comes from genuinely thorough pacing across the whole arc, not padding.`;
}
