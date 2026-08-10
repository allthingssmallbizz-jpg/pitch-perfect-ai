"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MouseEvent, ReactNode } from "react";

// Wraps a tool-grid card's Link. When discovery is still incomplete, the href points back at
// this same page (?intent=...) — same pathname, so nothing visibly changes on click beyond the
// query string (no new page, and App Router doesn't scroll a same-segment navigation), which
// reads as "clicking agents does nothing." This makes that redirect impossible to miss: it
// still navigates (so the "Save discovery" redirect-on-complete flow keeps working), but also
// scrolls the discovery form into view and fires a toast explaining why.
export default function ToolLink({
  href,
  needsDiscovery,
  agentName,
  className,
  children,
}: {
  href: string;
  needsDiscovery: boolean;
  agentName: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!needsDiscovery) return;
    e.preventDefault();
    router.push(href);
    document.getElementById("discovery-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast(`Finish the discovery brief below first — then this takes you straight into ${agentName}.`);
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
