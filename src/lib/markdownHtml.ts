import { marked } from "marked";
import TurndownService from "turndown";

// Every generator/analyzer already produces markdown-flavored text (headers with #, bullets
// with -, "---" as section/slide separators — see the PDF/docx export routes, which already
// treat content this way). The rich text editor round-trips through HTML for editing but keeps
// markdown as the actual stored/exported format, so nothing downstream has to change.
marked.setOptions({ gfm: true, breaks: true });

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "_",
});

turndown.addRule("horizontalRule", {
  filter: "hr",
  replacement: () => "\n\n---\n\n",
});

export function markdownToHtml(markdown: string): string {
  if (!markdown) return "";
  return marked.parse(markdown) as string;
}

export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  return turndown.turndown(html).trim();
}
