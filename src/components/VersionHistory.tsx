"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { History, Loader2, RotateCcw, Trash2, Sparkles, Pencil, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { GenerationVersion, GenerationVersionSource } from "@/types/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SOURCE_META: Record<GenerationVersionSource, { label: string; Icon: typeof Sparkles; className: string }> = {
  generate: { label: "Generated", Icon: Sparkles, className: "text-primary" },
  edit: { label: "Edited", Icon: Pencil, className: "text-muted-foreground" },
  snapshot: { label: "Snapshot", Icon: Camera, className: "text-muted-foreground" },
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return d.toLocaleString();
}

export default function VersionHistory({
  generationId,
  currentContent,
  onRestored,
}: {
  generationId: string;
  currentContent: string;
  onRestored: (content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<GenerationVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("generation_versions")
      .select("*")
      .eq("generation_id", generationId)
      .order("created_at", { ascending: false });
    setVersions(data ?? []);
    setLoading(false);
  }

  // Fetched from the dialog's open-change handler (a user-driven event), not a useEffect keyed
  // on `open` — that would need a synchronous setLoading(true) inside the effect body, which
  // the project's hooks lint flags as a cascading-render anti-pattern (see useDebouncedCallback
  // and OnboardingTour for the same fix pattern elsewhere).
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  const selected = useMemo<GenerationVersion | null>(
    () => versions.find((v) => v.id === selectedId) ?? versions[0] ?? null,
    [versions, selectedId]
  );

  async function handleRestore(v: GenerationVersion) {
    setRestoring(true);
    try {
      const res = await fetch(`/api/generations/${generationId}/versions/${v.id}/restore`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Restore failed");
      toast.success("Version restored");
      setOpen(false);
      onRestored(data.content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  }

  async function handleDelete(v: GenerationVersion) {
    setDeleting(v.id);
    try {
      const res = await fetch(`/api/generations/${generationId}/versions/${v.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      toast.success("Version deleted");
      await load();
      if (selectedId === v.id) setSelectedId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  const count = versions.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="mr-1.5 h-4 w-4" />
          History{count > 0 ? ` (${count})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[80vh] max-w-5xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border/60 p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Version history
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Every generation and manual save is kept. Preview and restore any past version.
          </p>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr]">
          <div className="min-h-0 overflow-y-auto border-r border-border/60">
            {loading ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : count === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No saved versions yet. Generate or save an edit to start building history.
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {versions.map((v, i) => {
                  const meta = SOURCE_META[v.source];
                  const isSel = (selected?.id ?? null) === v.id;
                  const isCurrent = v.content === currentContent && i === 0;
                  return (
                    <li key={v.id}>
                      <button
                        onClick={() => setSelectedId(v.id)}
                        className={`w-full p-4 text-left transition-colors hover:bg-card/40 ${
                          isSel ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <meta.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.className}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{v.label ?? meta.label}</span>
                              {isCurrent && (
                                <Badge variant="outline" className="h-5 border-primary/40 text-[10px] text-primary">
                                  Current
                                </Badge>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {formatWhen(v.created_at)} · {meta.label}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex min-h-0 flex-col">
            {selected ? (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-border/60 p-4">
                  <div className="text-xs text-muted-foreground">{selected.content.length.toLocaleString()} chars</div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(selected.content);
                        toast.success("Copied");
                      }}
                    >
                      Copy
                    </Button>
                    <Button variant="ghost" size="sm" disabled={deleting === selected.id} onClick={() => handleDelete(selected)}>
                      {deleting === selected.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                        </>
                      )}
                    </Button>
                    <Button size="sm" disabled={restoring || selected.content === currentContent} onClick={() => handleRestore(selected)}>
                      {restoring ? (
                        <>
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Restoring
                        </>
                      ) : (
                        <>
                          <RotateCcw className="mr-1.5 h-4 w-4" /> Restore this version
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <pre className="whitespace-pre-wrap p-6 font-sans text-sm leading-relaxed">{selected.content}</pre>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Select a version to preview
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
