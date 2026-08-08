"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Volume2, Play, Pause, Square, Loader2, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TTS_VOICES, TTS_CREDIT_COST, type TtsVoice } from "@/lib/ai/tts";

type Props = {
  text: string;
  title?: string;
};

// Strips markdown so the TTS reads only spoken content, not formatting syntax.
function cleanForSpeech(md: string): string {
  return md
    .replace(/^\s*---+\s*$/gm, ". ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkForTts(text: string, maxChars = 1800): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];
  const sentences = clean.match(/[^.!?\n]+[.!?]?(?:\s+|\n+|$)/g) ?? [clean];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (s.length > maxChars) {
      if (cur.trim()) {
        chunks.push(cur.trim());
        cur = "";
      }
      for (let i = 0; i < s.length; i += maxChars) chunks.push(s.slice(i, i + maxChars));
      continue;
    }
    if (cur.length + s.length > maxChars) {
      chunks.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

export default function TtsPlayer({ text, title }: Props) {
  const [voice, setVoice] = useState<TtsVoice>("alloy");
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [index, setIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const stoppedRef = useRef(false);

  const chunks = useMemo(() => chunkForTts(cleanForSpeech(text)), [text]);
  const totalChunks = chunks.length;
  const wordCount = useMemo(() => (cleanForSpeech(text).match(/\S+/g) ?? []).length, [text]);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function fetchChunk(chunk: string): Promise<Blob> {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunk, voice }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error ?? `Voice playback failed (${res.status})`);
    }
    return await res.blob();
  }

  async function playFrom(startIdx: number) {
    if (!chunks.length) {
      toast.error("Nothing to read yet.");
      return;
    }
    stoppedRef.current = false;
    setStatus("loading");

    for (let i = startIdx; i < chunks.length; i++) {
      if (stoppedRef.current) return;
      setIndex(i);
      try {
        const blob = await fetchChunk(chunks[i]);
        if (stoppedRef.current) return;

        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        if (!audioRef.current) audioRef.current = new Audio();
        const audio = audioRef.current;
        audio.src = url;

        setStatus("playing");
        await audio.play();

        await new Promise<void>((resolve) => {
          const onEnded = () => {
            cleanup();
            resolve();
          };
          const onPause = () => {
            if (stoppedRef.current) {
              cleanup();
              resolve();
            }
          };
          const cleanup = () => {
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("pause", onPause);
          };
          audio.addEventListener("ended", onEnded);
          audio.addEventListener("pause", onPause);
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Voice playback failed");
        setStatus("idle");
        return;
      }
    }
    setStatus("idle");
    setIndex(0);
  }

  function handlePlay() {
    if (status === "paused" && audioRef.current) {
      setStatus("playing");
      void audioRef.current.play();
      return;
    }
    void playFrom(index || 0);
  }
  function handlePause() {
    if (audioRef.current) {
      audioRef.current.pause();
      setStatus("paused");
    }
  }
  function handleStop() {
    stoppedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setStatus("idle");
    setIndex(0);
  }
  function handlePrev() {
    stoppedRef.current = true;
    if (audioRef.current) audioRef.current.pause();
    const next = Math.max(0, index - 1);
    setIndex(next);
    setTimeout(() => void playFrom(next), 50);
  }
  function handleNext() {
    stoppedRef.current = true;
    if (audioRef.current) audioRef.current.pause();
    const next = Math.min(chunks.length - 1, index + 1);
    setIndex(next);
    setTimeout(() => void playFrom(next), 50);
  }

  const estMinutes = Math.max(1, Math.round(wordCount / 150));

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/40 to-card/20 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/30 bg-primary/15">
            <Volume2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">Read aloud{title ? ` — ${title}` : ""}</div>
            <div className="text-xs text-muted-foreground">
              ~{wordCount.toLocaleString()} words · ~{estMinutes} min · {TTS_CREDIT_COST} credit
              {totalChunks > 1 ? "s" : ""}/part
              {totalChunks > 1 && ` · part ${Math.min(index + 1, totalChunks)}/${totalChunks}`}
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <select
          value={voice}
          onChange={(e) => {
            handleStop();
            setVoice(e.target.value as TtsVoice);
          }}
          className="h-9 w-[180px] rounded-md border border-input bg-input/30 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {TTS_VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          {totalChunks > 1 && (
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
              disabled={status === "loading" || index === 0}
              title="Previous part"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
          )}
          {status === "playing" ? (
            <Button size="sm" onClick={handlePause}>
              <Pause className="mr-1.5 h-4 w-4" /> Pause
            </Button>
          ) : status === "loading" ? (
            <Button size="sm" disabled>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Loading…
            </Button>
          ) : (
            <Button size="sm" onClick={handlePlay} title="Play">
              <Play className="mr-1.5 h-4 w-4" />
              {status === "paused" ? "Resume" : "Play"}
            </Button>
          )}
          {(status !== "idle" || index > 0) && (
            <Button variant="outline" size="icon" onClick={handleStop} title="Stop">
              <Square className="h-4 w-4" />
            </Button>
          )}
          {totalChunks > 1 && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              disabled={status === "loading" || index >= totalChunks - 1}
              title="Next part"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
