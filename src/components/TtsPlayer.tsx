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
  // Reported: on a long script/webinar, it's easy to lose track of where the voice actually is,
  // so a mistake heard while listening is hard to find and fix afterward. OpenAI's TTS API gives
  // back audio only, no per-word timestamps, so this is an estimate (see tokenizeWithOffsets):
  // called with the plain word it currently thinks is being spoken (proportional to how far
  // through the chunk's characters playback has gotten), or `null` to clear whatever was last
  // highlighted. Never called while paused — the last word stays highlighted on purpose, since
  // pausing to go fix something is exactly the point of this.
  onActiveWordChange?: (word: string | null) => void;
};

// No real per-word timestamps exist for this audio, so this distributes words across the
// chunk's audio duration by character count — a longer word is assumed to take proportionally
// longer to say. Rough, but close enough to point at roughly the right spot while listening;
// see the `timeupdate` handler in playFrom for how it's actually used.
function tokenizeWithOffsets(text: string): { word: string; start: number }[] {
  return Array.from(text.matchAll(/\S+/g)).map((m) => ({ word: m[0], start: m.index }));
}

// Strips leading/trailing punctuation so "word," or "(word)" still matches the bare word in the
// live document — RichTextEditor's findWordInDoc searches for exactly this trimmed form.
function trimWordPunctuation(word: string): string {
  return word.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, "");
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

export default function TtsPlayer({
  text,
  title,
  assetType,
  startsFromMarker,
  openSignal = 0,
  onActiveWordChange,
}: Props) {
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
  // Which word (by index into the current chunk's tokenizeWithOffsets list) was last reported as
  // active — reset to -1 at the start of every chunk so its very first word always fires once,
  // even if it happens to land back on index 0 like the previous chunk's last reported word did.
  const lastWordIndexRef = useRef(-1);
  // The floating "follow" control below portals straight to document.body — reported as not
  // showing up at all on a phone, most likely because some ancestor between this component and
  // the page root (a transformed/contained element anywhere up the tree — sidebar layouts are a
  // common source of exactly this) was quietly turning `position: fixed` into "fixed relative to
  // that ancestor" instead of the real viewport, the same reliability problem Radix/shadcn's own
  // Dialog and Toast portal to the body to avoid. document doesn't exist during server rendering,
  // so the portal only ever renders once useIsClient confirms this is running in the browser.
  const isClient = useIsClient();
  // Reported again: the follow control "doesn't even activate" on a phone, though it works fine
  // on a laptop. The actual trigger (tapping inside the document to choose a read-from point) is
  // a tap into a contenteditable field, which opens the on-screen keyboard — and on a phone, the
  // keyboard does NOT shrink the CSS layout viewport that `position: fixed; bottom: 0` is anchored
  // to (only the visual viewport shrinks), so the floater is still rendering, just pinned to the
  // bottom of the full-height layout viewport sitting behind the keyboard, off-screen. A laptop
  // has no on-screen keyboard, so this never reproduces there. Tracking how much shorter the
  // visible (visual) viewport currently is than the full layout viewport, and lifting the floater
  // by exactly that much, keeps it above the keyboard instead of hidden underneath it.
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function updateInset() {
      if (!vv) return;
      setKeyboardInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    }
    updateInset();
    vv.addEventListener("resize", updateInset);
    vv.addEventListener("scroll", updateInset);
    return () => {
      vv.removeEventListener("resize", updateInset);
      vv.removeEventListener("scroll", updateInset);
    };
  }, []);

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
    onActiveWordChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

        const tokens = tokenizeWithOffsets(chunks[i]);
        const totalChars = chunks[i].length || 1;
        lastWordIndexRef.current = -1;
        const onTimeUpdate = () => {
          if (!tokens.length || !audio.duration || !Number.isFinite(audio.duration)) return;
          const charPos = (audio.currentTime / audio.duration) * totalChars;
          let lo = 0;
          let hi = tokens.length - 1;
          let found = 0;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (tokens[mid].start <= charPos) {
              found = mid;
              lo = mid + 1;
            } else {
              hi = mid - 1;
            }
          }
          if (found !== lastWordIndexRef.current) {
            lastWordIndexRef.current = found;
            const trimmed = trimWordPunctuation(tokens[found].word);
            if (trimmed) onActiveWordChange?.(trimmed);
          }
        };
        audio.addEventListener("timeupdate", onTimeUpdate);

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
            audio.removeEventListener("timeupdate", onTimeUpdate);
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
    onActiveWordChange?.(null);
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
    onActiveWordChange?.(null);
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
            className="fixed inset-x-0 z-[100] flex justify-center px-4"
            style={{
              bottom: keyboardInset,
              paddingBottom: keyboardInset ? "1rem" : "max(1rem, env(safe-area-inset-bottom))",
            }}
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
