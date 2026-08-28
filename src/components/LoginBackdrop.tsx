import { AGENTS, type AgentAssetType } from "@/lib/agents/config";

// Ambient hero background for /login — Aaron Bowe, "The AI Outlaw" and creator of Pitch Perfect
// AI, centered directly behind the auth form at low opacity, flanked on both sides by small
// glowing badges for a few of the app's actual AI agents (pulled from AGENTS, not invented copy)
// so the two flanks read as "AI agents at work" rather than empty space. Everything here is
// `pointer-events-none` and sits behind the page's real content (the page wraps its actual
// content in a `relative z-10` sibling) — purely decorative, so the photo and badges are
// `aria-hidden`.
//
// public/creator-hero.png is the member's own finished creative — his neon rim-light outline
// already designed and baked in — used completely as-is, no processing of any kind (no
// grayscale, no edge-detection, no recoloring). Earlier versions generated their own outline
// treatment from the raw photo; this replaces that entirely per direct instruction to just use
// the supplied image.
//
// Brand palette: dark blue/black base with a single royal-blue accent (oklch hue ~255) — no gold
// or purple. The page's own background (see login/page.tsx) is likewise an explicit dark navy,
// not the app's near-black default, so the whole hero reads as "dark blue," not "black."

type BadgeSpec = {
  assetType: AgentAssetType;
  shortLabel: string;
  top: string;
  inset: string;
};

// Eight of the app's real agents, four flanking each side — deliberately not every agent (that
// would be busy), just enough to read as "a roster at work." shortLabel mirrors the sidebar's
// CREATE_LABELS wording (AppSidebar.tsx) rather than the longer ASSET_GENERATORS label.
const LEFT_BADGES: BadgeSpec[] = [
  { assetType: "webinar_outline", shortLabel: "Webinar Outline", top: "9%", inset: "left-[6%]" },
  { assetType: "landing_page", shortLabel: "Landing Page", top: "34%", inset: "left-[2%]" },
  { assetType: "offer_ladder", shortLabel: "Offer Ladder", top: "58%", inset: "left-[8%]" },
  { assetType: "challenge_outline", shortLabel: "Challenge", top: "80%", inset: "left-[3%]" },
];

const RIGHT_BADGES: BadgeSpec[] = [
  { assetType: "vsl_script", shortLabel: "VSL Script", top: "9%", inset: "right-[5%]" },
  { assetType: "email_sequence", shortLabel: "Email Sequence", top: "34%", inset: "right-[2%]" },
  { assetType: "ad_copy", shortLabel: "Ad Copy", top: "58%", inset: "right-[7%]" },
  { assetType: "thank_you_page", shortLabel: "Thank You Page", top: "80%", inset: "right-[3%]" },
];

function AgentBadge({ spec }: { spec: BadgeSpec }) {
  const agent = AGENTS[spec.assetType];
  return (
    <div className={`absolute hidden flex-col items-center gap-1.5 lg:flex ${spec.inset}`} style={{ top: spec.top }}>
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full text-2xl"
        style={{
          background: "linear-gradient(160deg, oklch(0.16 0.04 258 / 92%), oklch(0.08 0.02 258 / 92%))",
          border: "1px solid oklch(0.6 0.22 255 / 50%)",
          boxShadow:
            "0 0 0 1px oklch(1 0 0 / 4%) inset, 0 0 18px oklch(0.55 0.24 255 / 45%), 0 0 40px oklch(0.55 0.24 255 / 20%)",
        }}
      >
        {agent.emoji}
      </div>
      <div className="text-center text-[10px] font-medium tracking-wide text-foreground/70 uppercase">
        {agent.name.replace(/^Agent\s+/, "")}
      </div>
      <div className="text-center text-[9px] whitespace-nowrap text-muted-foreground/60">{spec.shortLabel}</div>
    </div>
  );
}

export default function LoginBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Ambient glows — royal blue only, heavily blurred. One centered up top, one on each
          side lower down, so both flanks get a bit of color instead of just the center. */}
      <div
        className="absolute -top-36 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full opacity-[0.18] blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.24 255) 0%, transparent 70%)" }}
      />
      <div
        className="absolute top-[30%] -left-[10%] h-[520px] w-[520px] rounded-full opacity-[0.16] blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.4 0.1 260) 0%, transparent 70%)" }}
      />
      <div
        className="absolute -right-[8%] -bottom-[10%] h-[520px] w-[520px] rounded-full opacity-[0.16] blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.24 255) 0%, transparent 70%)" }}
      />

      {/* Small constellation clusters flanking each side, layered with the agent badges below for
          a bit of connective texture. */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.18]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        fill="none"
      >
        <g stroke="oklch(0.6 0.15 258)" strokeWidth="1">
          <line x1="130" y1="150" x2="230" y2="230" />
          <line x1="230" y1="230" x2="150" y2="330" />
          <line x1="1310" y1="150" x2="1210" y2="230" />
          <line x1="1210" y1="230" x2="1290" y2="330" />
          <line x1="150" y1="580" x2="230" y2="640" />
          <line x1="230" y1="640" x2="170" y2="740" />
          <line x1="1290" y1="580" x2="1210" y2="640" />
          <line x1="1210" y1="640" x2="1270" y2="740" />
        </g>
      </svg>

      {LEFT_BADGES.map((spec) => (
        <AgentBadge key={spec.assetType} spec={spec} />
      ))}
      {RIGHT_BADGES.map((spec) => (
        <AgentBadge key={spec.assetType} spec={spec} />
      ))}

      {/* The hero image itself — centered directly behind the form, shifted up so his face and
          cap clear the top of the card. Always rendered, unlike the agent badges below — an
          earlier version hid this behind `lg:block` (>=1024px), which meant it silently
          disappeared *entirely* on any narrower browser window, not just repositioned. That's a
          very ordinary width for a non-maximized laptop window, so it was effectively invisible
          for a lot of real visits.
          The `top` offset is in vw, not %: the image's own width (and therefore height, fixed
          aspect ratio) is vw-based, so a %-of-container-*height* offset (the previous version)
          decouples from how much of the image is actually showing once the viewport gets
          narrower — at 800px wide the same percentage cropped his whole face off the top, even
          though it looked right at 1440px. -16vw keeps cap-to-crop-line distance proportional to
          the image's own rendered size instead. It's clamped to a fixed px floor for the same
          reason once width hits its 700px cap (very wide monitors) — past that point the image
          stops growing but a pure vw offset would keep growing, cropping the cap again from the
          other direction. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative background art, not
          the page's LCP element; needs a raw <img> for free positioning that next/image's fill
          mode doesn't support cleanly */}
      <img
        src="/creator-hero.png"
        alt=""
        className="absolute left-1/2 w-[46vw] max-w-[700px] -translate-x-1/2 opacity-[0.25]"
        style={{ top: "max(-16vw, -243px)" }}
      />
    </div>
  );
}
