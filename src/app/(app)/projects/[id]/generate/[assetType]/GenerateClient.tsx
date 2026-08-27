"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import type { AssetType, GenerationMode } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy, FileDown, Save, Loader2, Trash2, History, Eye, Code2, ExternalLink, Palette } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import VersionHistory from "@/components/VersionHistory";
import TtsPlayer from "@/components/TtsPlayer";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import {
  CSS_COLOR_VARS,
  extractCssColorVars,
  looksLikeHtmlDocument,
  replaceCssColorVar,
  WEB_PAGE_ASSET_TYPES,
} from "@/lib/ai/generators/htmlPage";
import { downloadHtmlFile, openInBrowserTab } from "@/lib/browserFile";

export type PastGeneration = { id: string; createdAt: string; preview: string };

// Landing Page and Thank You Page are the generators whose content is a real HTML document, not
// markdown — used both to build a clean preview snippet (raw tags would otherwise show up as
// literal text in the "Past generations" list) and client-side for the .html download filename/blob.
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// Instant, no-regeneration color editing: every HTML-page generator declares its palette as 4 CSS
// custom properties (see htmlPage.ts), so changing a color here is a plain string replace in the
// saved HTML — no AI call, no trip back to the Brand Voice page, no losing the rest of the page.
function ColorVarEditor({
  vars,
  onChange,
}: {
  vars: Record<string, string>;
  onChange: (varName: string, hex: string) => void;
}) {
  return (
    <div className="card-elevated rounded-xl p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <Palette className="h-4 w-4" />
        Quick colors — change instantly, no regenerating
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CSS_COLOR_VARS.map(({ name, label }) => {
          const value = vars[name] ?? "#888888";
          const swatchValue = HEX_COLOR_PATTERN.test(value) ? value : "#888888";
          return (
            <div key={name}>
              <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={`${label} picker`}
                  value={swatchValue}
                  onChange={(e) => onChange(name, e.target.value)}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
                />
                <input
                  value={value}
                  onChange={(e) => onChange(name, e.target.value)}
                  className="h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-xs"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function GenerateClient({
  projectId,
  assetType,
  mode,
  initialContent,
  initialGenerationId,
  initialPastGenerations,
}: {
  projectId: string;
  assetType: AssetType;
  mode: GenerationMode;
  initialContent: string | null;
  initialGenerationId: string | null;
  initialPastGenerations: PastGeneration[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isWebPageAsset = WEB_PAGE_ASSET_TYPES.includes(assetType);
  const downloadFilename = assetType === "thank_you_page" ? "thank-you-page.html" : "landing-page.html";
  const [content, setContent] = useState<string | null>(initialContent);
  const [generationId, setGenerationId] = useState<string | null>(initialGenerationId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pastGenerations, setPastGenerations] = useState<PastGeneration[]>(initialPastGenerations);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Web-page assets' content is a real HTML document — default to seeing it rendered as an
  // actual page, with source editing as the secondary option, rather than starting on raw markup.
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");

  const colorVars = useMemo(() => (content && isWebPageAsset ? extractCssColorVars(content) : null), [content, isWebPageAsset]);

  const autosave = useDebouncedCallback((newContent: string, id: string) => {
    fetch(`/api/generations/${id}/autosave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newContent }),
    }).catch(() => {});
  }, 1200);

  function handleEditorChange(markdown: string) {
    setContent(markdown);
    setSaved(false);
    if (generationId) autosave(markdown, generationId);
  }

  function updateColorVar(varName: string, hex: string) {
    if (!content) return;
    const updated = replaceCssColorVar(content, varName, hex);
    setContent(updated);
    setSaved(false);
    if (generationId) autosave(updated, generationId);
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, assetType, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed.");
        return;
      }
      setContent(data.content);
      setGenerationId(data.generationId);
      const previewSource = isWebPageAsset ? stripHtmlTags(String(data.content)) : String(data.content).replace(/\s+/g, " ").trim();
      setPastGenerations((prev) => [
        { id: data.generationId, createdAt: new Date().toISOString(), preview: previewSource.slice(0, 120) },
        ...prev,
      ]);
      // A plain browser History API call, not router.replace() — this page reads searchParams
      // server-side, so router.replace() would force Next.js to re-fetch and re-render the
      // whole server tree for the route right after we just set the freshly-generated content
      // in local state, racing against it (and, worse, potentially racing the database write
      // that just happened — a stale re-read could reflect the row before it finished saving).
      // All this needs to do is update the address bar so a refresh doesn't lose track of which
      // generation is showing; it doesn't need — and must not trigger — any re-render.
      window.history.replaceState(null, "", `${pathname}?generationId=${data.generationId}`);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  function openPast(pastId: string) {
    router.push(`${pathname}?generationId=${pastId}`);
  }

  async function deletePast(pastId: string) {
    if (!window.confirm("Delete this generation? This can't be undone.")) return;
    setDeletingId(pastId);
    try {
      const res = await fetch(`/api/generations/${pastId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Could not delete.");
      }
      setPastGenerations((prev) => prev.filter((g) => g.id !== pastId));
      if (generationId === pastId) {
        setContent(null);
        setGenerationId(null);
        router.replace(pathname);
      }
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setDeletingId(null);
    }
  }

  async function saveVersion() {
    if (!generationId || content === null) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/generations/${generationId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not save.");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function copyToClipboard() {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={loading}>
          <Sparkles className="mr-2 h-4 w-4" />
          {loading ? "Generating..." : content ? "Regenerate" : "Generate"}
        </Button>
        {content && (
          <>
            <Button variant="outline" onClick={copyToClipboard}>
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "Copied!" : "Copy"}
            </Button>
            {generationId && (
              <>
                <Button variant="outline" onClick={saveVersion} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {saved ? "Saved!" : "Save"}
                </Button>
                <VersionHistory
                  generationId={generationId}
                  currentContent={content}
                  onRestored={(restored) => setContent(restored)}
                />
                {isWebPageAsset ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => openInBrowserTab(content)}
                      disabled={!looksLikeHtmlDocument(content)}
                      title={
                        looksLikeHtmlDocument(content)
                          ? "Open in a new browser tab, full-width, exactly as a visitor would see it"
                          : "Regenerate first — this was saved before the visual redesign"
                      }
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Preview in browser
                    </Button>
                    <Button variant="outline" onClick={() => downloadHtmlFile(downloadFilename, content)}>
                      <FileDown className="mr-2 h-4 w-4" />
                      Download HTML
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" asChild>
                      <a href={`/api/export/pdf?generationId=${generationId}`}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Export PDF
                      </a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={`/api/export/docx?generationId=${generationId}`}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Export .docx
                      </a>
                    </Button>
                  </>
                )}
              </>
            )}
            {isWebPageAsset && (
              <div className="ml-auto flex overflow-hidden rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setViewMode("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${
                    viewMode === "preview" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("edit")}
                  className={`flex items-center gap-1.5 border-l border-border px-3 py-1.5 text-sm ${
                    viewMode === "edit" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Code2 className="h-4 w-4" />
                  Edit HTML
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {pastGenerations.length > 0 && (
        <details className="mb-4 rounded-xl border border-border bg-card/30" open={pastGenerations.length <= 3}>
          <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <History className="mr-1.5 inline h-4 w-4" />
            Past generations from this agent ({pastGenerations.length})
          </summary>
          <ul className="divide-y divide-border/60 border-t border-border">
            {pastGenerations.map((g) => (
              <li
                key={g.id}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm ${g.id === generationId ? "bg-primary/5" : ""}`}
              >
                <button onClick={() => openPast(g.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(g.createdAt)}</span>
                    {g.id === generationId && (
                      <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Viewing
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-muted-foreground">{g.preview || "(empty)"}</div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={deletingId === g.id}
                  onClick={() => deletePast(g.id)}
                  title="Delete this generation"
                >
                  {deletingId === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {loading && !content && (
        <div className="card-elevated rounded-2xl border-dashed p-10 text-center text-muted-foreground">
          Building your asset with the Pitch Perfect Method™...
        </div>
      )}

      {content && isWebPageAsset && (
        <div className="space-y-4">
          {colorVars && <ColorVarEditor vars={colorVars} onChange={updateColorVar} />}
          {viewMode === "preview" ? (
            looksLikeHtmlDocument(content) ? (
              <div className="overflow-hidden rounded-xl border border-border/60 bg-white">
                {/* sandbox with no allow-scripts/allow-same-origin — this is AI-generated markup
                    rendered inside an authenticated app, so it must not be able to run script or
                    reach this origin's session, even though the generator is instructed not to
                    include any <script> tags in the first place. */}
                <iframe
                  title="Landing page preview"
                  srcDoc={content}
                  sandbox=""
                  className="h-[900px] w-full"
                />
              </div>
            ) : (
              <div className="card-elevated rounded-2xl border-dashed p-10 text-center text-muted-foreground">
                This was generated before the visual redesign, so it&apos;s plain text, not a real
                page — click <strong>Regenerate</strong> above to get an actual designed page, or
                switch to <strong>Edit HTML</strong> to see the old content.
              </div>
            )
          ) : (
            <textarea
              value={content}
              onChange={(e) => handleEditorChange(e.target.value)}
              spellCheck={false}
              className="h-[600px] w-full rounded-xl border border-border/60 bg-card/40 p-4 font-mono text-xs leading-relaxed focus:outline-none"
            />
          )}
        </div>
      )}

      {content && !isWebPageAsset && (
        <div className="space-y-4">
          <TtsPlayer text={content} />
          <RichTextEditor markdown={content} onChange={handleEditorChange} />
        </div>
      )}

      {!content && !loading && (
        <div className="card-elevated rounded-2xl border-dashed p-10 text-center text-muted-foreground">
          Click Generate to build this asset from your project&apos;s discovery data.
        </div>
      )}
    </div>
  );
}
