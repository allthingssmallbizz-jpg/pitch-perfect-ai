"use client";

import { useSyncExternalStore } from "react";

// Same pattern as use-mobile.tsx's useIsMobile: read an "external" (here, trivial/unchanging)
// source via useSyncExternalStore rather than the classic `useState(false) + useEffect(() =>
// setState(true))` mount-flag idiom, which the project's stricter hooks lint rule
// (react-hooks/set-state-in-effect) flags as a cascading-render anti-pattern.
function subscribe() {
  return () => {};
}
function getSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}

export function useIsClient() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
