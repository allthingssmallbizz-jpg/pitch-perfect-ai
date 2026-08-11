"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Copy, FileDown, Save, Loader2, Trash2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function SocialCompareClient({
  initialContent,
  initialGenerationId,
  initialPastGenerations,
}: {
  initialContent: string | null;
  initialGenerationId: string | null;
  initialPastGenerations: PastGeneration[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [yourUrl, setYourUrl] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
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
    if (!yourUrl.trim() || !referenceUrl.trim()) {
      setError("Enter both your page and the reference page to compare.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze/social-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yourUrl, referenceUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Comparison failed.");
        return;
      }
      setContent(data.content);
      setGenerationId(data.generationId);
      setPastGenerations((prev) => [
        {
          id: data.generationId,
          createdAt: new Date().toISOString(),
          preview: String(data.content).replace(/\s+/g, " ").trim().slice(0, 120),
        },
        ...prev,
      ]);
      // See GenerateClient.tsx's identical comment: window.history, not router.replace(), so
      // this doesn't force a server re-render right after setting freshly-generated content.
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
    if (!window.confirm("Delete this comparison? This can't be undone.")) return;
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
      <div className="card-elevated mb-4 space-y-3 rounded-2xl p-4">
        <div>
          <Label htmlFor="your-url">Your page</Label>
          <Input
            id="your-url"
            placeholder="e.g. tiktok.com/@yourhandle or instagram.com/yourhandle"
            value={yourUrl}
            onChange={(e) => setYourUrl(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="reference-url">High-performing page to compare against</Label>
          <Input
            id="reference-url"
            placeholder="e.g. tiktok.com/@someoneperformingwell"
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
            className="mt-1"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          TikTok, Instagram, and Facebook block most automated reading, so results depend on
          what each platform publicly exposes for that page — usually the bio/description and a
          preview image. If a page returns too little to work with, you&apos;ll get a clear
          message saying so rather than a made-up analysis.
        </p>
        <Button onClick={run} disabled={loading}>
          <Sparkles className="mr-2 h-4 w-4" />
          {loading ? "Comparing..." : content ? "Compare again" : "Compare"}
        </Button>
      </div>

      {content && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
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
        </div>
      )}

      {pastGenerations.length > 0 && (
        <details className="mb-4 rounded-xl border border-border bg-card/30" open={pastGenerations.length <= 3}>
          <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <History className="mr-1.5 inline h-4 w-4" />
            Past comparisons ({pastGenerations.length})
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
                  title="Delete this comparison"
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
          Reading both pages and building your comparison...
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
          Enter both pages above and click Compare.
        </div>
      )}
    </div>
  );
}
