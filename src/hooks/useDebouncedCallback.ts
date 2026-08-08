"use client";

import { useCallback, useEffect, useRef } from "react";

// Delays invoking `fn` until `delayMs` has passed without another call — used for autosave so
// every keystroke doesn't hit the network, only a pause in typing does.
export function useDebouncedCallback<Args extends unknown[]>(fn: (...args: Args) => void, delayMs: number) {
  const fnRef = useRef(fn);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keeps the debounced function calling the latest `fn` without resetting the pending timer
  // on every render — refs are for values read outside of render, so this sync belongs in an
  // effect rather than directly in the render body.
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (...args: Args) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => fnRef.current(...args), delayMs);
    },
    [delayMs]
  );
}
