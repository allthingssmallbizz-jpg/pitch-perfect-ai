"use client";

import { useState } from "react";
import type { PresentationType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Gauge, Copy, FileDown } from "lucide-react";

const PRESENTATION_TYPE_OPTIONS: { value: PresentationType; label: string }[] = [
  { value: "webinar", label: "Webinar" },
  { value: "vsl", label: "Video Sales Letter (VSL)" },
  { value: "sales_presentation", label: "Sales presentation / pitch deck" },
  { value: "investor_pitch", label: "Investor pitch" },
  { value: "other", label: "Other marketing presentation" },
];

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

  async function copyToClipboard() {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
        <pre className="card-elevated whitespace-pre-wrap rounded-2xl p-6 text-sm leading-relaxed">{content}</pre>
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={run} disabled={loading || input.trim().length < 200}>
        <Gauge className="mr-2 h-4 w-4" />
        {loading ? "Analyzing..." : "Run analysis"}
      </Button>

      {loading && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Running the full 19-point conversion review — this can take a minute for longer scripts.
        </div>
      )}
    </div>
  );
}
