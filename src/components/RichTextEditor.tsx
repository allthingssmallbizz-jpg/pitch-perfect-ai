"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo,
  Redo,
  Minus,
  Link as LinkIcon,
} from "lucide-react";
import { markdownToHtml, htmlToMarkdown } from "@/lib/markdownHtml";

type Props = {
  /** Markdown content passed in. */
  markdown: string;
  /** Fires with the current markdown after each change. */
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
};

// Editor over Tiptap. Accepts and emits markdown (via src/lib/markdownHtml.ts) so the rest of
// the app — exports, TTS, generation storage — keeps treating `generations.content` as markdown
// and doesn't need to change.
export default function RichTextEditor({ markdown, onChange, placeholder, className }: Props) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialHtml = useMemo(() => markdownToHtml(markdown), []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Start writing…",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "text-primary underline underline-offset-2" },
      }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-invert prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] px-5 py-4 " +
          "prose-headings:font-bold prose-headings:tracking-tight prose-strong:text-foreground " +
          "prose-p:my-3 prose-li:my-1 prose-hr:my-6 prose-hr:border-primary/30",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(htmlToMarkdown(editor.getHTML()));
    },
  });

  // If the incoming markdown changes from the outside (e.g. a version restore), sync the
  // editor without wiping the caret unnecessarily.
  useEffect(() => {
    if (!editor) return;
    const currentMd = htmlToMarkdown(editor.getHTML());
    if (currentMd.trim() === markdown.trim()) return;
    editor.commands.setContent(markdownToHtml(markdown), { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

  useEffect(() => () => editor?.destroy(), [editor]);

  if (!editor) {
    return <div className="min-h-[540px] animate-pulse rounded-xl border border-border/60 bg-card/40" />;
  }

  const btn = (active: boolean) =>
    `h-8 w-8 p-0 ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <div className={`overflow-hidden rounded-xl border border-border/60 bg-card/40 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-card/60 px-2 py-1.5">
        <Button
          size="sm"
          variant="ghost"
          className={btn(editor.isActive("bold"))}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={btn(editor.isActive("italic"))}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={btn(editor.isActive("strike"))}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          size="sm"
          variant="ghost"
          className={btn(editor.isActive("heading", { level: 1 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={btn(editor.isActive("heading", { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={btn(editor.isActive("heading", { level: 3 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          size="sm"
          variant="ghost"
          className={btn(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={btn(editor.isActive("orderedList"))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={btn(editor.isActive("blockquote"))}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={btn(editor.isActive("codeBlock"))}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code block"
        >
          <Code className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          size="sm"
          variant="ghost"
          className={btn(false)}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Section separator"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={btn(editor.isActive("link"))}
          onClick={() => {
            const prev = editor.getAttributes("link").href as string | undefined;
            const url = window.prompt("Link URL", prev ?? "https://");
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
          title="Link"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        <Button
          size="sm"
          variant="ghost"
          className={btn(false)}
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
          disabled={!editor.can().undo()}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={btn(false)}
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
          disabled={!editor.can().redo()}
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
