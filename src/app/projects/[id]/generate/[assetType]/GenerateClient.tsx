"use client";

import { useState } from "react";
import type { AssetType, GenerationMode } from "@/types/database";

export default function GenerateClient({
  projectId,
  assetType,
  mode,
  initialContent,
  initialGenerationId,
}: {
  projectId: string;
  assetType: AssetType;
  mode: GenerationMode;
  initialContent: string | null;
  initialGenerationId: string | null;
}) {
  const [content, setContent] = useState<string | null>(initialContent);
  const [generationId, setGenerationId] = useState<string | null>(initialGenerationId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={run}
          disabled={loading}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? "Generating..." : content ? "Regenerate" : "Generate"}
        </button>
        {content && (
          <>
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
          </>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading && !content && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
          Building your asset with the Pitch Perfect Method™...
        </div>
      )}

      {content && (
        <pre className="whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-6 text-sm leading-relaxed">
          {content}
        </pre>
      )}

      {!content && !loading && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
          Click Generate to build this asset from your project&apos;s discovery data.
        </div>
      )}
    </div>
  );
}
