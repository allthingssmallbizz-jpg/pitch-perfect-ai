"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useIsClient } from "@/hooks/useIsClient";
import { Volume2, Play, Pause, Square, Loader2, SkipBack, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TTS_VOICES, TTS_CREDIT_COST, type TtsVoice } from "@/lib/ai/tts";
import { cleanSpokenScript } from "@/lib/ai/spokenScriptText";
import type { AssetType } from "@/types/database";

type Props = {
  text: string;
  title?: string;
  // Needed so VSL Script/Webinar Script can have their own structural labels (beat numbers,
  // "Slide #: Title") stripped before anything is spoken — see cleanSpokenScript. Optional and a
  // no-op for every other/unknown asset type, which keeps exactly the markdown-syntax-only
  // cleanup this already did for every existing caller that has no reason to pass it.
  assetType?: AssetType;
  // True when `text` is a trailing slice starting from where the member clicked in the document,
  // not the whole thing — purely for the hint line below; doesn't change playback itself.
  startsFromMarker?: boolean;
  // Bumped by the parent every time the member clicks inside the document/slide list to choose
  // a new read-from point (not when `text` changes for any other reason, like a regenerate, an
  // AI edit, or a restored version) — the one signal this component can't derive from `text`
  // alone, since a content replacement and a click-to-position both just look like "text
  // changed" from here. Reported: clicking a start point still required scrolling back to the
  // top to actually press Play, and the floating control disappeared the moment the member
  // clicked elsewhere in the text. This is what makes the floater pop open on its own right
  // where the member clicked, instead of only ever appearing once something is already playing.
  openSignal?: number;
};

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

export default function TtsPlayer({ text, title, assetType, startsFromMarker, openSignal = 0 }: Props) {
  const [voice, setVoice] = useState<TtsVoice>("alloy");
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [index, setIndex] = useState(0);
  // Whether the floating "follow" control is on screen at all — deliberately independent of
  // `status`. Reported: it used to disappear the instant playback stopped/paused, or the moment
  // the member clicked a new spot in the text, forcing a scroll back up to the top just to press
  // Play again. Now it only ever closes when the member explicitly dismisses it (the X button
  // below) or the underlying content is actually replaced (regenerate/AI edit/restore — see the
  // `text`+`openSignal` effect), never on its own as a side effect of play/pause/stop.
  const [floaterOpen, setFloaterOpen] = useState(false);
  const prevOpenSignalRef = useRef(openSignal);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const stoppedRef = useRef(false);
  // The floating "follow" control below portals straight to document.body — reported as not
  // showing up at all on a phone, most likely because some ancestor between this component and
  // the page root (a transformed/contained element anywhere up the tree — sidebar layouts are a
  // common source of exactly this) was quietly turning `position: fixed` into "fixed relative to
  // that ancestor" instead of the real viewport, the same reliability problem Radix/shadcn's own
  // Dialog and Toast portal to the body to avoid. document doesn't exist during server rendering,
  // so the portal only ever renders once useIsClient confirms this is running in the browser.
  const isClient = useIsClient();

  const cleaned = useMemo(() => cleanSpokenScript(text, assetType), [text, assetType]);
  const chunks = useMemo(() => chunkForTts(cleaned), [cleaned]);
  const totalChunks = chunks.length;
  const wordCount = useMemo(() => (cleaned.match(/\S+/g) ?? []).length, [cleaned]);

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

  // `text` changes whenever the member clicks a new spot in the document (the parent swaps in
  // the trailing slice from that point) or the content itself is replaced (Regenerate, an AI
  // edit, restoring a version) — chunk boundaries for the OLD text no longer mean anything for
  // the new one, so any in-flight audio (a real external <audio> element, exactly what an effect
  // is for) and the old chunk index have to be dropped rather than left pointing at the wrong
  // place. Not cascading in the way the lint rule normally guards against — status/index land on
  // the same idle/0 reset every single time this fires, so it can never trigger a further change.
  useEffect(() => {
    stoppedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("idle");
    setIndex(0);
    // Only a real click-to-position (openSignal bumped by the parent) should pop the floater
    // open on its own — a regenerate/AI-edit/restore also changes `text` but should close it
    // instead, since whatever was loaded/playing no longer matches the new content.
    setFloaterOpen(openSignal !== prevOpenSignalRef.current);
    prevOpenSignalRef.current = openSignal;
  }, [text, openSignal]);

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
    setFloaterOpen(true);

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
            {startsFromMarker && (
              <div className="text-xs text-primary">
                Starting from where you last clicked (in the text, or a slide&apos;s &quot;Read from here&quot;) — click back at the very beginning to read the whole thing instead.
              </div>
            )}
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

      {/* Reported: pausing or stopping mid-read meant scrolling all the way back up to this card
          — on a long deck/document, that's a real scroll on both desktop and a phone. Reported
          again as not appearing on a phone at all after the first attempt — portaled straight to
          document.body now (see isClient above) so no ancestor between this card and the page
          root can interfere with its fixed positioning. Reported a third time: it kept vanishing
          the instant playback paused/stopped, or the moment the member clicked a new spot in the
          text, right when they actually wanted it open. Visibility is now its own state
          (floaterOpen) instead of being tied to `status` — it opens itself on a real click-to-
          position or on Play, and from then on only the explicit X button below closes it, so
          pausing/stopping/clicking around the document never makes it disappear on its own. The
          safe-area inset is set via a plain inline style, not a Tailwind arbitrary value — CSS
          `max()` with a comma inside Tailwind's `[...]` bracket syntax is exactly the kind of
          thing that can silently fail to generate, which a plain style attribute can't get
          wrong. */}
      {isClient &&
        floaterOpen &&
        createPortal(
          <div
            className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
              <Volume2 className="h-4 w-4 shrink-0 text-primary" />
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {status === "loading"
                  ? "Loading…"
                  : status === "playing"
                    ? "Reading aloud"
                    : status === "paused"
                      ? "Paused"
                      : "Ready to play"}
                {totalChunks > 1 && ` · ${Math.min(index + 1, totalChunks)}/${totalChunks}`}
              </span>
              {status === "playing" ? (
                <Button size="sm" onClick={handlePause}>
                  <Pause className="mr-1.5 h-4 w-4" /> Pause
                </Button>
              ) : status === "loading" ? (
                <Button size="sm" disabled>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Loading…
                </Button>
              ) : (
                <Button size="sm" onClick={handlePlay}>
                  <Play className="mr-1.5 h-4 w-4" /> {status === "paused" ? "Resume" : "Play"}
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={handleStop} title="Stop">
                <Square className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setFloaterOpen(false)} title="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
