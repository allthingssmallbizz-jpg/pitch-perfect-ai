"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import type { AssetType, GenerationMode } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy, FileDown, Save, Loader2, Trash2, History } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import VersionHistory from "@/components/VersionHistory";
import TtsPlayer from "@/components/TtsPlayer";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

export type PastGeneration = { id: string; createdAt: string; preview: string };

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
  const [content, setContent] = useState<string | null>(initialContent);
  const [generationId, setGenerationId] = useState<string | null>(initialGenerationId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pastGenerations, setPastGenerations] = useState<PastGeneration[]>(initialPastGenerations);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      setPastGenerations((prev) => [
        { id: data.generationId, createdAt: new Date().toISOString(), preview: String(data.content).replace(/\s+/g, " ").trim().slice(0, 120) },
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
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Could not save.");
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

      {content && (
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
