"use client";

import { useState } from "react";
import type { PresentationType } from "@/types/database";

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
          <button
            onClick={() => {
              setContent(null);
              setGenerationId(null);
            }}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
          >
            Analyze another
          </button>
          <button
            onClick={copyToClipboard}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          {generationId && (
            <>
              <a
                href={`/api/export/pdf?generationId=${generationId}`}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
              >
                Export PDF
              </a>
              <a
                href={`/api/export/docx?generationId=${generationId}`}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
              >
                Export .docx
              </a>
            </>
          )}
        </div>
        <pre className="whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-6 text-sm leading-relaxed">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700">What is this?</label>
        <select
          value={presentationType}
          onChange={(e) => setPresentationType(e.target.value as PresentationType)}
          className="mt-1 w-full max-w-xs rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          {PRESENTATION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700">
          Paste your script, transcript, or slide/speaker-note text
        </label>
        <p className="mt-1 text-xs text-neutral-500">
          This analyzes the text of your presentation. It can&apos;t watch a video, so
          delivery-specific criteria (voice, energy, eye contact, lighting) will be flagged as
          not assessable unless you describe them in the notes.
        </p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={16}
          placeholder="Paste the full script or transcript here..."
          className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-neutral-400">{input.length.toLocaleString()} characters</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={run}
        disabled={loading || input.trim().length < 200}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {loading ? "Analyzing..." : "Run analysis"}
      </button>

      {loading && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
          Running the full 19-point conversion review — this can take a minute for longer scripts.
        </div>
      )}
    </div>
  );
}
