import type { Project } from "@/types/database";
import { formatDiscoveryBlock } from "./shared";
import { EXPRESS_AUDIENCE_TYPES, EXPRESS_FORMATS, expressMinutes, type ExpressBrief } from "@/lib/express";

// The Pitch Perfect Express™ Speaker Kit (Agent Fiona): everything around the presentation that
// decides whether it actually converts — how the presenter is introduced, the close itself, honest
// answers to hesitations, and the follow-up for people who were interested but didn't act yet.
// Built from the member's latest Express presentation and the brief it was made from.
export const EXPRESS_KIT_CREDIT_COST = 4;
export const EXPRESS_KIT_MAX_OUTPUT_TOKENS = 7000;

export function buildExpressKitPrompt(
  project: Project,
  deckContent?: string,
  brief?: ExpressBrief | null
): string {
  if (!deckContent) throw new Error("The Speaker Kit needs an Express presentation to build from.");
  const briefBlock = brief
    ? `THE PRESENTATION'S BRIEF:
- Where and to whom: ${brief.setting}
- Audience: ${EXPRESS_AUDIENCE_TYPES[brief.audienceType].label} — ${brief.audience}
- Their problem or opportunity: ${brief.problem}
- The goal (what they should do next): ${brief.goal}
- The offer: ${brief.offer}
- Proof the presenter can stand behind: ${brief.proof || "none provided"}
- About the presenter, in their own words: ${brief.aboutYou}
- Format: ${EXPRESS_FORMATS[brief.format].label}, about ${expressMinutes(brief)} minutes`
    : "";

  return `Create the Pitch Perfect Express™ Speaker Kit for the presentation below — the pieces around the slides that turn a good talk into real next steps.

${briefBlock}

THE PRESENTATION (for context — match its message, offer, and call to action exactly):
${deckContent}

Output these five sections, in this order, with these exact headings:

## 1. Your Introduction (for the host to read)
60-90 words the event host or group leader reads aloud before the presenter speaks: who they are, why they're relevant to THIS audience, and what the audience will get from the next few minutes. Third person. Ends by welcoming the presenter by name.

## 2. Speaker Bio
A short version (about 50 words) and a full version (120-150 words), third person, warm and credible — for event flyers, programs, and introductions. Use only facts the presenter actually gave; never invent credentials, awards, client counts, or results.

## 3. The Close — Word for Word
The exact words for the invitation at the end of the presentation: a short recap of what's possible for them, the invitation to the specific next step, exactly how to take it right now (in the room or meeting), and a warm final line. Then a short "How to collect the next step" checklist suited to this setting (for example a sign-up card, a QR code, a calendar link, or setting a date on the spot).

## 4. Answers to Hesitations
The 5 hesitations this audience is most likely to have about the next step, each with an honest, respectful response the presenter can say out loud (2-3 sentences). Never use pressure, guilt, or fake urgency, and never promise results that weren't provided.

## 5. Follow-Up Messages
For people who showed interest but haven't taken the next step yet:
- Email 1 (same day), Email 2 (2 days later), Email 3 (5 days later) — each with a subject line and a short, personal body (under 150 words), each giving one more reason or one helpful idea, and the same clear next step.
- Text message 1, 2, and 3 for the same days — each under 300 characters, friendly and personal.
Use [First Name] and [Link] where personal details go. Keep the voice warm and helpful, never pushy.

Write everything in plain, natural language that sounds like the presenter, specific to this audience — never generic. Never invent facts, results, testimonials, or numbers; write [NEEDS: ...] where something specific is genuinely missing.

GENERAL BUSINESS BACKGROUND (from this project's Discovery — may be incomplete):
${formatDiscoveryBlock(project)}`;
}
