"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AgentAtWork from "@/components/AgentAtWork";
import { AGENTS } from "@/lib/agents/config";
import { WEBINAR_SCORE_CREDIT_COST, WEBINAR_SCORE_MAX_CHARS, WEBINAR_SCORE_MIN_CHARS } from "@/lib/webinarScore/schema";

export default function WebinarScoreForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceType, setSourceType] = useState<"pptx" | "text">("text");
  const [slideCount, setSlideCount] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reuses Annie's free PowerPoint text extraction — the slide text lands in the box below so the
  // member can see exactly what will be scored.
  async function handleFile(file: File) {
    setExtracting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/analyze/pptx", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not read that PowerPoint file.");
      setContent(data.text);
      setSlideCount(data.slideCount ?? null);
      setSourceType("pptx");
      setFileName(file.name);
      if (!title) setTitle(file.name.replace(/\.pptx$/i, ""));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that PowerPoint file.");
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function score() {
    setScoring(true);
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    try {
      const res = await fetch("/api/webinar-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sourceType, slideCount, content }),
      });
      const data = await res.json().catch(() => null);
      if (!data) {
        // The connection dropped — the score keeps running on the server and shows up in the list.
        toast.message("Still scoring — your result will appear in the list below shortly.");
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error(data.error || "Scoring didn't finish.");
      router.push(`/webinar-score/${data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scoring didn't finish.");
      router.refresh();
    } finally {
      clearInterval(timer);
      setScoring(false);
    }
  }

  const length = content.trim().length;
  const tooShort = length < WEBINAR_SCORE_MIN_CHARS;
  const tooLong = length > WEBINAR_SCORE_MAX_CHARS;

  if (scoring) {
    return (
      <AgentAtWork
        agent={AGENTS.presentation_analysis}
        task="other"
        deliverable="webinar score"
        elapsedSeconds={elapsed}
        variant="inline"
        canLeave={false}
      />
    );
  }

  return (
    <div className="card-elevated space-y-4 rounded-2xl p-6">
      <div>
        <label className="text-sm font-medium" htmlFor="webinar-title">
          Webinar name <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="webinar-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. My Funding Masterclass"
          className="mt-1"
        />
      </div>

      <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
        <p className="text-sm font-medium">Upload your PowerPoint</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          A .pptx file — we read the text on every slide. (Google Slides or Keynote: download it as PowerPoint first.)
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".pptx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Button variant="outline" size="sm" className="mt-3" disabled={extracting} onClick={() => fileRef.current?.click()}>
          {extracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
          {fileName ? "Choose a different file" : "Choose .pptx file"}
        </Button>
        {fileName && (
          <p className="mt-2 text-xs text-emerald-400">
            Loaded {fileName}
            {slideCount ? ` — ${slideCount} slides` : ""}. The slide text is below.
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="webinar-content">
          …or paste your webinar script, transcript, or slide outline
        </label>
        <Textarea
          id="webinar-content"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (sourceType === "pptx" && !fileName) setSourceType("text");
          }}
          rows={12}
          placeholder="Paste the whole thing — every slide or the full script. The more complete it is, the more accurate the score."
          className="mt-1 text-sm"
        />
        <p className={`mt-1 text-xs ${tooLong ? "text-destructive" : "text-muted-foreground"}`}>
          {length.toLocaleString()} characters
          {tooShort && length > 0 ? ` — add more (at least ${WEBINAR_SCORE_MIN_CHARS} to score it)` : ""}
          {tooLong ? ` — too long (max ${WEBINAR_SCORE_MAX_CHARS.toLocaleString()})` : ""}
        </p>
      </div>

      <Button onClick={score} disabled={tooShort || tooLong || extracting}>
        Score my webinar ({WEBINAR_SCORE_CREDIT_COST} credits)
      </Button>
      <p className="text-xs text-muted-foreground">You&apos;re only charged if the score finishes.</p>
    </div>
  );
}
