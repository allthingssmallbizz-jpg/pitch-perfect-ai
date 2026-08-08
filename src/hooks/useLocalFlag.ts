"use client";

import { useCallback, useState } from "react";

const KEY_SAMPLE_OFFERED = "ppa:sample_project_offered";
const KEY_TOUR_PREFIX = "ppa:tour:";

function readFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writeFlag(key: string, value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

// Local-only "have we shown this before" flags for onboarding — the tour and the sample
// project offer are one-time nudges, not account state, so localStorage is enough and avoids
// a DB column that would only ever be read once per browser.
//
// `key` is expected to be a stable literal per call site (every caller in this app passes a
// constant) — the initial value is read once via useState's lazy initializer, which is enough
// since the only writer of this flag is the setter this hook itself returns.
export function useLocalFlag(key: string) {
  const [value, setValue] = useState<boolean>(() => readFlag(key));
  const setFlag = useCallback(
    (next: boolean) => {
      writeFlag(key, next);
      setValue(next);
    },
    [key]
  );
  return [value, setFlag] as const;
}

export const onboardingKeys = {
  sampleOffered: KEY_SAMPLE_OFFERED,
  tour: (name: string) => `${KEY_TOUR_PREFIX}${name}`,
};
