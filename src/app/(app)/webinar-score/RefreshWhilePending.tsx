"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// While a score is still running (e.g. the page was reloaded mid-score), re-check every few
// seconds so the finished result appears without the member refreshing.
export default function RefreshWhilePending() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
