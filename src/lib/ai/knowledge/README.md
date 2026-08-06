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
- `05-vsl-25-part.md` — placeholder 25-part VSL structure (see note in file)

## Adding the remaining knowledge base files

The user has ~5 more knowledge docs to add (Coach Bowe mentioned more playbooks — likely
the VSL Playbook, sales page / landing page playbooks, email/launch sequence playbook, and
book format template). To add each one:

1. Extract its text (see `/scripts/extract-pdf.md` if working from a PDF).
2. Condense it the same way as the files above — pull out the named frameworks, phase
   tables, and operating rules; drop the prose/exercises. Aim for <3-4KB per file so the
   system prompt stays cheap to run on every generation.
3. Save it as `NN-slug.md` in this folder.
4. Add it to the `KNOWLEDGE_FILES` array in `src/lib/ai/systemPrompt.ts`.
5. If a doc maps to a specific generator (e.g. a real VSL playbook replacing
   `05-vsl-25-part.md`), update that generator's prompt in `src/lib/ai/generators/` to point
   to it explicitly.

If a doc is large and used by only one generator (not every asset type), don't add it to
`KNOWLEDGE_FILES` (which loads on every call) — instead load it directly inside that one
generator function so other generations don't pay for context they don't need.
