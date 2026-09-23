"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "./useDebouncedCallback";

// Client-only safety net for long, easy-to-lose forms (Discovery, the guided intake, the
// presenter bio) — every change is mirrored into localStorage as it's typed, and restored the
// moment the form mounts if a draft is found, so a crashed browser, a closed tab, or a dead
// connection before hitting Save never means retyping everything from scratch. Purely a local,
// per-browser backup: the account's real saved data always lives in Supabase; this only protects
// whatever hasn't reached Supabase yet, and it's cleared the moment a real save actually succeeds
// (see clearDraft, called from each form's own success state) so a stale draft never lingers to
// clobber a later, deliberately different answer.
export function useFormDraft({
  storageKey,
  collect,
  restore,
}: {
  storageKey: string;
  // Reads every field's current value at the moment of a save-worthy pause in typing.
  collect: () => Record<string, string>;
  // Writes a restored draft's values back into the form — into React state, the DOM, or both,
  // whatever each form's own fields need.
  restore: (draft: Record<string, string>) => void;
}) {
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const appliedRef = useRef(false);

  // Runs once, on mount, before anything the member does could overwrite what's already loaded
  // from the server — a draft is only ever a local backup of edits that never reached Supabase,
  // so it must apply before any subsequent edit, never after.
  useEffect(() => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { values?: Record<string, string>; savedAt?: string };
      if (!parsed?.values || Object.keys(parsed.values).length === 0) return;
      restore(parsed.values);
      // One-time hydration from localStorage (unavailable during SSR, so this can't move into
      // the lazy useState initializer instead) — guarded by appliedRef above, this never
      // re-fires, so it can't cascade the way the lint rule is normally guarding against.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRestoredAt(parsed.savedAt ?? null);
    } catch {
      // Corrupt/unreadable draft, or storage unavailable in this browser (private mode, quota) —
      // never block the form itself over a failed local backup.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced rather than on every keystroke — this only needs to survive a crash between
  // pauses in typing, not capture every single character as it's pressed.
  const persist = useDebouncedCallback(() => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ values: collect(), savedAt: new Date().toISOString() })
      );
    } catch {
      // Private browsing / storage full — draft safety is best-effort and must never block typing
      // or the real save.
    }
  }, 800);

  // Memoized so callers can safely list it as an effect dependency (e.g. "clear the draft once
  // the save action reports success") without that effect re-running on every unrelated render.
  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return { persist, clearDraft, restoredAt };
}
