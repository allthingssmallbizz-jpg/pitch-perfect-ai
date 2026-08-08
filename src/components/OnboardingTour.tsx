"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, X } from "lucide-react";
import { onboardingKeys, useLocalFlag } from "@/hooks/useLocalFlag";
import { useIsClient } from "@/hooks/useIsClient";

export type TourStep = {
  /** CSS selector (e.g. `[data-tour="..."]`) to spotlight. If not found, the step is centered. */
  target?: string;
  title: string;
  body: React.ReactNode;
  placement?: "bottom" | "top" | "left" | "right";
};

type Props = {
  /** Unique tour name — persisted in localStorage so it only shows once. */
  tourKey: string;
  steps: TourStep[];
};

// Minimal spotlight tour, no external deps: a dark overlay with a cutout box around the target
// element (via clip-path) plus a floating tooltip card. Shows once per browser (localStorage),
// spotlighting sidebar items via `data-tour` attributes (see AppSidebar.tsx).
export default function OnboardingTour({ tourKey, steps }: Props) {
  const [seen, setSeen] = useLocalFlag(onboardingKeys.tour(tourKey));
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const mounted = useIsClient();

  const isOpen = !seen;

  const step = steps[i];

  useLayoutEffect(() => {
    if (!isOpen || !step) return;

    let raf = 0;
    const measure = () => {
      if (!step.target) {
        setRect(null);
        return;
      }
      const el = document.querySelector<HTMLElement>(step.target);
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      raf = requestAnimationFrame(() => setRect(el.getBoundingClientRect()));
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const interval = setInterval(measure, 500);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      clearInterval(interval);
    };
  }, [isOpen, i, step]);

  function finish() {
    setSeen(true);
    setI(0);
  }

  if (!isOpen || !mounted || !step) return null;

  const pad = 8;
  const spot = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  const placement = step.placement ?? "bottom";
  const tooltipStyle: React.CSSProperties = spot
    ? (() => {
        const gap = 14;
        const base: React.CSSProperties = { position: "fixed", zIndex: 10001, maxWidth: 360 };
        switch (placement) {
          case "top":
            return { ...base, top: spot.top - gap, left: spot.left + spot.width / 2, transform: "translate(-50%, -100%)" };
          case "left":
            return { ...base, top: spot.top + spot.height / 2, left: spot.left - gap, transform: "translate(-100%, -50%)" };
          case "right":
            return { ...base, top: spot.top + spot.height / 2, left: spot.left + spot.width + gap, transform: "translateY(-50%)" };
          default:
            return { ...base, top: spot.top + spot.height + gap, left: spot.left + spot.width / 2, transform: "translateX(-50%)" };
        }
      })()
    : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 10001, maxWidth: 420 };

  return createPortal(
    <div className="pointer-events-none">
      <div
        className="pointer-events-auto fixed inset-0 z-[10000]"
        onClick={() => setI((n) => Math.min(steps.length - 1, n + 1))}
        style={
          spot
            ? {
                background: "transparent",
                boxShadow: `0 0 0 9999px rgba(0,0,0,0.72)`,
                clipPath: `polygon(
                  0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                  ${spot.left}px ${spot.top}px,
                  ${spot.left}px ${spot.top + spot.height}px,
                  ${spot.left + spot.width}px ${spot.top + spot.height}px,
                  ${spot.left + spot.width}px ${spot.top}px,
                  ${spot.left}px ${spot.top}px
                )`,
              }
            : { background: "rgba(0,0,0,0.72)" }
        }
      />
      {spot && (
        <div
          className="pointer-events-none fixed z-[10000] rounded-lg ring-2 ring-primary/70"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      )}

      <div
        style={tooltipStyle}
        className="pointer-events-auto w-[min(360px,calc(100vw-32px))] rounded-xl border border-primary/40 bg-card p-5 shadow-2xl"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="text-xs uppercase tracking-wider text-primary/80">
            Tour · {i + 1} of {steps.length}
          </div>
          <button onClick={finish} className="-mr-1 -mt-1 text-muted-foreground hover:text-foreground" title="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h4 className="mb-1.5 text-base font-semibold">{step.title}</h4>
        <div className="text-sm text-muted-foreground">{step.body}</div>

        <div className="mt-4 flex items-center justify-between">
          <button onClick={finish} className="text-xs text-muted-foreground hover:text-foreground">
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setI((n) => Math.max(0, n - 1))}>
                Back
              </Button>
            )}
            {i < steps.length - 1 ? (
              <Button size="sm" onClick={() => setI((n) => Math.min(steps.length - 1, n + 1))}>
                Next <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={finish}>
                Got it
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
