# Knowledge library

These files are condensed reference context loaded into the system prompt for every
generation (see `src/lib/ai/systemPrompt.ts`). They're distilled from the Pitch Perfect AI
Knowledge Library playbooks so the AI produces output in the correct Pitch Perfect
structure without paying the token cost of the full source PDFs on every call.

Currently encoded:
- `00-philosophy.md` — Playbook 1: The Pitch Perfect Philosophy (workflow, pillars, standards)
- `01-ppos.md` — the universal Pitch Perfect Presentation Operating System (PPOS)
- `02-discovery.md` — Playbook 2: The Discovery Operating Manual
- `03-webinar.md` — Playbook 8: The Ultimate Perfect Webinar Operating Manual (PPWOS)
- `04-sales-presentation.md` — Playbook 9: The Sales Presentation Playbook (PPSOS)
- `05-vsl-25-part.md` — Playbook 7: The Ultimate VSL Operating Manual (real 25-stage
  structure — loaded only by the VSL generator, not the universal system prompt; see
  "Per-generator files" below)
- `06-value-proposition.md` — Playbook 6: The Value Proposition Operating Manual
- `07-customer-awareness.md` — Playbook 4: The Customer Awareness Operating Manual
  (the Five Levels of Awareness)
- `08-offer-creation.md` — Playbook 11: The Ultimate Offer Creation Operating Manual
  (PPOS-Offer)
- `09-campaign-architecture.md` — Playbook 12: The Ultimate Campaign Architecture
  Operating Manual (PPCOS — cross-asset consistency)

`KNOWLEDGE_FILES` in `systemPrompt.ts` currently loads 00, 01, 02, 06, 07, 08, 09, 03, 04 on
every generation (the universal strategic layers, in the order the playbooks say they should
happen — Discovery → Awareness → Value → Offer → Campaign — followed by the two
format-specific frameworks currently in use). `05-vsl-25-part.md` is loaded only inside
`src/lib/ai/generators/vslScript.ts` via `getKnowledgeFile()`, since it's only relevant to one
asset type — see "Per-generator files" below.

## Still to add

Not yet folded in, if provided later: a dedicated sales-page/landing-page playbook (currently
those two generators rely on PPOS + Value Proposition + Offer Creation directly), and an
email/launch-sequence-specific playbook (currently relies on PPOS + Campaign Architecture).

## Adding a new knowledge base file

1. Extract its text (see `/scripts/extract-pdf.md` if working from a PDF).
2. Condense it the same way as the files above — pull out the named frameworks, phase
   tables, and operating rules; drop the prose/exercises. Aim for <3-4KB per file so the
   system prompt stays cheap to run on every generation.
3. Save it as `NN-slug.md` in this folder.
4. Add it to the `KNOWLEDGE_FILES` array in `src/lib/ai/systemPrompt.ts` **only if it's
   universally relevant** (applies to every asset type). See "Per-generator files" below if not.
5. If a doc maps to a specific generator (e.g. a real sales-page playbook), update that
   generator's prompt in `src/lib/ai/generators/` to reference it directly.

## Per-generator files

If a doc is large and used by only one generator (not every asset type), don't add it to
`KNOWLEDGE_FILES` (which loads on every call) — instead call `getKnowledgeFile("NN-slug.md")`
directly inside that one generator function (see `vslScript.ts` for the pattern) so other
generations don't pay for context they don't need.
