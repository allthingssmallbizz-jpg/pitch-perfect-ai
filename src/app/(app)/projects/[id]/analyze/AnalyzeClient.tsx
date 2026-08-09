"use client";

import { useEffect, useRef, useState } from "react";
import type { GenerationStatus, PresentationType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { Gauge, Copy, FileDown, Upload, Video, X, Save, Loader2 } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import VersionHistory from "@/components/VersionHistory";
import TtsPlayer from "@/components/TtsPlayer";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

// Kept in sync with PRESENTATION_TYPE_LABELS in src/lib/ai/analyzer.ts — duplicated here rather
// than imported so this client component doesn't pull that module's much larger
// ANALYZER_SYSTEM_PROMPT string into the browser bundle for the sake of one small label map.
const PRESENTATION_TYPE_OPTIONS: { value: PresentationType; label: string }[] = [
  { value: "webinar", label: "Webinar" },
  { value: "vsl", label: "Video Sales Letter (VSL)" },
  { value: "sales_presentation", label: "Sales presentation / pitch deck" },
  { value: "investor_pitch", label: "Investor pitch" },
  { value: "youtube_video", label: "YouTube video" },
  { value: "instagram_reel", label: "Instagram Reel / video" },
  { value: "tiktok_video", label: "TikTok video" },
  { value: "other", label: "Other marketing presentation" },
];

// Kept in sync with src/lib/ai/videoAnalyzer.ts — duplicated as plain numbers here since this
// is a client component and that module isn't safe to import client-side (pulls in server-only
// video/AI libs transitively via the pipeline).
const VIDEO_MAX_DURATION_MINUTES = 90;
const VIDEO_MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;
const VIDEO_ANALYZER_CREDIT_COST = 20;

const PROGRESS_LABELS: Partial<Record<GenerationStatus, string>> = {
  pending: "Preparing upload...",
  uploaded: "Starting analysis...",
  transcribing: "Extracting and transcribing audio...",
  extracting_frames: "Sampling video frames for visual review...",
  analyzing: "Running the full conversion review...",
};

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

export default function AnalyzeClient({
  projectId,
  initialContent,
  initialGenerationId,
}: {
  projectId: string;
  initialContent: string | null;
  initialGenerationId: string | null;
}) {
  const [presentationType, setPresentationType] = useState<PresentationType>("webinar");
  const [input, setInput] = useState("");
  const [content, setContent] = useState<string | null>(initialContent);
  const [generationId, setGenerationId] = useState<string | null>(initialGenerationId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [videoStatus, setVideoStatus] = useState<GenerationStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, presentationType, content: input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Analysis failed.");
        return;
      }
      setContent(data.content);
      setGenerationId(data.generationId);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  function pollGeneration(id: string) {
    const supabase = createClient();
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("generations")
        .select("status, content, error")
        .eq("id", id)
        .single();
      if (!data) return;

      setVideoStatus(data.status);

      if (data.status === "complete") {
        if (pollRef.current) clearInterval(pollRef.current);
        setLoading(false);
        setContent(data.content);
        setGenerationId(id);
      } else if (data.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        setLoading(false);
        setError(data.error || "Video analysis failed. You were not charged credits.");
      }
    }, 4000);
  }

  async function runVideo() {
    if (!videoFile) return;
    setLoading(true);
    setError(null);
    setUploadProgress(0);
    setVideoStatus(null);

    try {
      const startRes = await fetch("/api/analyze/video/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, presentationType }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) {
        setError(startData.error || "Could not start video analysis.");
        setLoading(false);
        return;
      }
      const newGenerationId = startData.generationId as string;
      const ext = videoFile.name.split(".").pop() || "mp4";
      const storagePath = `${startData.path}.${ext}`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("presentation-videos")
        .upload(storagePath, videoFile, { contentType: videoFile.type || "video/mp4" });
      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        setLoading(false);
        return;
      }
      setUploadProgress(100);

      const processRes = await fetch("/api/analyze/video/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: newGenerationId, presentationType }),
      });
      const processData = await processRes.json();
      if (!processRes.ok) {
        setError(processData.error || "Could not start analysis.");
        setLoading(false);
        return;
      }

      setVideoStatus("uploaded");
      pollGeneration(newGenerationId);
    } catch {
      setError("Network error — try again.");
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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

  if (content) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setContent(null);
              setGenerationId(null);
              setVideoFile(null);
              setVideoStatus(null);
              setUploadProgress(null);
            }}
          >
            Analyze another
          </Button>
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
              <VersionHistory generationId={generationId} currentContent={content} onRestored={(restored) => setContent(restored)} />
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
        <div className="space-y-4">
          <TtsPlayer text={content} title="Analysis" />
          <RichTextEditor markdown={content} onChange={handleEditorChange} />
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated space-y-4 rounded-2xl p-6">
      <div>
        <Label htmlFor="presentationType">What is this?</Label>
        <select
          id="presentationType"
          value={presentationType}
          onChange={(e) => setPresentationType(e.target.value as PresentationType)}
          className="mt-1 flex h-9 w-full max-w-xs rounded-md border border-input bg-input/30 px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {PRESENTATION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <Tabs defaultValue="text">
        <TabsList>
          <TabsTrigger value="text">Paste text</TabsTrigger>
          <TabsTrigger value="video">Upload video</TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="space-y-4">
          <div>
            <Label htmlFor="content">Paste your script, transcript, or slide/speaker-note text</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              This analyzes the text of your presentation. It can&apos;t watch a video, so
              delivery-specific criteria (voice, energy, eye contact, lighting) will be flagged as
              not assessable unless you describe them in the notes.
            </p>
            <Textarea
              id="content"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={16}
              placeholder="Paste the full script or transcript here..."
              className="mt-2 font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground/70">{input.length.toLocaleString()} characters</p>
          </div>

          <Button onClick={run} disabled={loading || input.trim().length < 200}>
            <Gauge className="mr-2 h-4 w-4" />
            {loading ? "Analyzing..." : "Run analysis"}
          </Button>

          {loading && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
              Running the full 19-point conversion review — this can take a minute for longer scripts.
            </div>
          )}
        </TabsContent>

        <TabsContent value="video" className="space-y-4">
          <div>
            <Label htmlFor="video">Upload your recorded webinar, VSL, presentation, or short-form video</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Full delivery review — voice, pacing, energy, framing, and lighting — on top of the
              same 19-point rubric. Videos up to {VIDEO_MAX_DURATION_MINUTES} minutes and{" "}
              {formatBytes(VIDEO_MAX_FILE_SIZE_BYTES)} are supported. Costs {VIDEO_ANALYZER_CREDIT_COST}{" "}
              credits (transcription + vision analysis of a full-length video is more expensive to
              run than a text review).
            </p>

            <input
              ref={fileInputRef}
              id="video"
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setError(null);
                if (file && file.size > VIDEO_MAX_FILE_SIZE_BYTES) {
                  setError(`That file is ${formatBytes(file.size)} — over the ${formatBytes(VIDEO_MAX_FILE_SIZE_BYTES)} limit.`);
                  return;
                }
                setVideoFile(file);
              }}
            />

            {!videoFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-10 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                <Upload className="h-6 w-6" />
                <span className="text-sm">Click to choose a video file</span>
              </button>
            ) : (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{videoFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(videoFile.size)}</p>
                  </div>
                </div>
                {!loading && (
                  <button
                    type="button"
                    onClick={() => {
                      setVideoFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          <Button onClick={runVideo} disabled={loading || !videoFile}>
            <Gauge className="mr-2 h-4 w-4" />
            {loading ? "Analyzing..." : "Run video analysis"}
          </Button>

          {loading && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
              {uploadProgress !== null && uploadProgress < 100 ? (
                <p>Uploading video...</p>
              ) : (
                <p>
                  {videoStatus ? PROGRESS_LABELS[videoStatus] ?? "Working..." : "Uploading video..."}
                  <br />
                  <span className="text-xs">
                    Long webinars can take several minutes — this page will update automatically. You
                    can leave and come back; the analysis keeps running.
                  </span>
                </p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
