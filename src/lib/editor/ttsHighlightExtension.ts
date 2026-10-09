import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

// ProseMirror's own `descendants`/`nodesBetween` have no early-exit — returning `false` from the
// callback only skips that node's children, not the rest of the walk — so this is the standard
// throw-to-break idiom for stopping a traversal the moment a match is found, rather than scanning
// the entire rest of a long script/webinar on every single word while it's being read aloud.
const FOUND = Symbol("tts-highlight-found");

// Finds the next occurrence of `word` (whole-word, case-insensitive) in the document's text at or
// after `fromPos`, searching forward only — so repeated words resolve to the next one in reading
// order rather than jumping back to the first match in the whole document. The TTS audio has no
// real per-word timestamps (see TtsPlayer's proportional-by-character estimate), and the text
// actually spoken has had structural labels/markdown stripped (cleanSpokenScript) before it ever
// reaches here, so this is a best-effort alignment back onto the live document, not an exact one
// — a word cleanSpokenScript removed, or one split across a bold/italic boundary, is simply
// skipped rather than mis-highlighted.
export function findWordInDoc(
  doc: ProseMirrorNode,
  word: string,
  fromPos: number
): { from: number; to: number } | null {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  let result: { from: number; to: number } | null = null;
  try {
    doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return true;
      const nodeEnd = pos + node.text.length;
      if (nodeEnd <= fromPos) return true;
      const searchStart = Math.max(0, fromPos - pos);
      const match = re.exec(node.text.slice(searchStart));
      if (match) {
        const matchStart = pos + searchStart + match.index;
        result = { from: matchStart, to: matchStart + match[0].length };
        throw FOUND;
      }
      return true;
    });
  } catch (e) {
    if (e !== FOUND) throw e;
  }
  return result;
}

export const ttsHighlightPluginKey = new PluginKey<DecorationSet>("ttsHighlight");

// Backs the "follow along while it reads" highlight (see RichTextEditor's findAndHighlightWord).
// A ProseMirror decoration, not a document mark, since this is purely visual and must never touch
// the saved markdown — it's cleared the instant playback stops and never round-trips through
// htmlToMarkdown/onUpdate. Range is carried via transaction meta (`ttsHighlightPluginKey`): a
// {from, to} pair sets it, `null` clears it, and no meta at all just remaps the existing range
// through the transaction's changes so it keeps tracking the right words while the member types.
export const TtsHighlight = Extension.create({
  name: "ttsHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: ttsHighlightPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(ttsHighlightPluginKey) as { from: number; to: number } | null | undefined;
            if (meta === undefined) return old.map(tr.mapping, tr.doc);
            if (meta === null) return DecorationSet.empty;
            return DecorationSet.create(tr.doc, [
              Decoration.inline(meta.from, meta.to, {
                class: "tts-highlight rounded-sm bg-primary/35 transition-colors",
              }),
            ]);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
