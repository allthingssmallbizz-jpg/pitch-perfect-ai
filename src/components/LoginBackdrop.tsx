import { AGENTS, type AgentAssetType } from "@/lib/agents/config";

// Ambient hero background for /login — Aaron Bowe, "The AI Outlaw" and creator of Pitch Perfect
// AI, as a faint silhouette centered directly behind the auth form, with a blue/gold rim glow
// along his shoulders for a bit of energy, flanked on both sides by small glowing badges for a
// few of the app's actual AI agents (pulled from AGENTS, not invented copy) so the two flanks
// read as "AI agents at work" rather than empty space. Everything here is `pointer-events-none`
// and sits behind the page's real content (the page wraps its actual content in a `relative
// z-10` sibling) — purely decorative, so the photo and badges are `aria-hidden`.
//
// public/creator-silhouette.png is pre-processed: grayscale, a "levels" lift (`.linear(0.68,
// 58)`) that raises the hoodie's near-black shadows to a faint mid-gray so the WHOLE figure's
// outline reads at low opacity — not just the bright bits (skin, the white "AI OUTLAW" print,
// the paper) — plus a radial alpha feather baked in so the rectangular image bounds never show a
// hard edge. Sized wide enough that his shoulders and arms extend past the card on both sides.

type BadgeSpec = {
  assetType: AgentAssetType;
  shortLabel: string;
  top: string;
  inset: string;
  accent: "blue" | "gold";
};

// Eight of the app's real agents, four flanking each side — deliberately not every agent (that
// would be busy), just enough to read as "a roster at work." shortLabel mirrors the sidebar's
// CREATE_LABELS wording (AppSidebar.tsx) rather than the longer ASSET_GENERATORS label.
const LEFT_BADGES: BadgeSpec[] = [
  { assetType: "webinar_outline", shortLabel: "Webinar Outline", top: "9%", inset: "left-[6%]", accent: "blue" },
  { assetType: "landing_page", shortLabel: "Landing Page", top: "34%", inset: "left-[2%]", accent: "gold" },
  { assetType: "offer_ladder", shortLabel: "Offer Ladder", top: "58%", inset: "left-[8%]", accent: "blue" },
  { assetType: "challenge_outline", shortLabel: "Challenge", top: "80%", inset: "left-[3%]", accent: "gold" },
];

const RIGHT_BADGES: BadgeSpec[] = [
  { assetType: "vsl_script", shortLabel: "VSL Script", top: "9%", inset: "right-[5%]", accent: "gold" },
  { assetType: "email_sequence", shortLabel: "Email Sequence", top: "34%", inset: "right-[2%]", accent: "blue" },
  { assetType: "ad_copy", shortLabel: "Ad Copy", top: "58%", inset: "right-[7%]", accent: "gold" },
  { assetType: "thank_you_page", shortLabel: "Thank You Page", top: "80%", inset: "right-[3%]", accent: "blue" },
];

function AgentBadge({ spec }: { spec: BadgeSpec }) {
  const agent = AGENTS[spec.assetType];
  const ringColor = spec.accent === "gold" ? "oklch(0.8 0.16 85 / 55%)" : "oklch(0.75 0.15 260 / 45%)";
  const glow =
    spec.accent === "gold"
      ? "0 0 0 1px oklch(1 0 0 / 4%) inset, 0 0 18px oklch(0.8 0.16 85 / 45%), 0 0 40px oklch(0.8 0.16 85 / 20%)"
      : "0 0 0 1px oklch(1 0 0 / 4%) inset, 0 0 18px oklch(0.65 0.2 260 / 45%), 0 0 40px oklch(0.65 0.2 260 / 20%)";
  return (
    <div className={`absolute hidden flex-col items-center gap-1.5 lg:flex ${spec.inset}`} style={{ top: spec.top }}>
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full text-2xl"
        style={{
          background: "linear-gradient(160deg, oklch(0.18 0.03 260 / 90%), oklch(0.12 0.02 260 / 90%))",
          border: `1px solid ${ringColor}`,
          boxShadow: glow,
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
      {/* Ambient glows — brand-colored, heavily blurred. One centered up top, one on each side
          lower down, plus a warmer gold accent on the right, so both flanks get color instead of
          just the center. */}
      <div
        className="absolute -top-36 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full opacity-[0.16] blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.22 265) 0%, transparent 70%)" }}
      />
      <div
        className="absolute top-[30%] -left-[10%] h-[520px] w-[520px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.22 265) 0%, transparent 70%)" }}
      />
      <div
        className="absolute -right-[8%] -bottom-[10%] h-[520px] w-[520px] rounded-full opacity-[0.18] blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.62 0.19 300) 0%, transparent 70%)" }}
      />
      <div
        className="absolute top-[40%] right-[6%] h-[340px] w-[340px] rounded-full opacity-[0.14] blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.78 0.16 85) 0%, transparent 70%)" }}
      />

      {/* Small constellation clusters flanking each side, layered with the agent badges below for
          a bit of connective texture. */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.16]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        fill="none"
      >
        <g stroke="oklch(0.75 0.1 265)" strokeWidth="1">
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

      {/* The silhouette itself — centered directly behind the form, wide enough that his
          shoulders and arms extend past the card on both sides. A trio of blurred color blobs
          sits behind it, roughly hugging the cap and both shoulders, so the figure reads with a
          bit of rim-light energy rather than a flat gray cutout — blue on the left, gold on the
          right. Hidden below `lg`, same breakpoint as the agent badges: at narrower widths the
          card runs close to full width, so there's no room for the overflow that makes this
          composition work. */}
      <div className="absolute top-[-9%] left-1/2 hidden w-[52vw] max-w-[820px] -translate-x-1/2 lg:block">
        <div
          className="absolute top-[12%] left-[24%] h-[18%] w-[50%] rounded-full blur-[38px]"
          style={{ background: "radial-gradient(ellipse, oklch(0.75 0.14 250 / 60%) 0%, transparent 72%)" }}
        />
        <div
          className="absolute top-[30%] left-[6%] h-[48%] w-[34%] rotate-[-18deg] rounded-full blur-[38px]"
          style={{ background: "radial-gradient(ellipse, oklch(0.68 0.2 250 / 55%) 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-[28%] left-[58%] h-[50%] w-[36%] rotate-[16deg] rounded-full blur-[38px]"
          style={{ background: "radial-gradient(ellipse, oklch(0.8 0.16 85 / 55%) 0%, transparent 70%)" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative background art, not
            the page's LCP element; needs a raw <img> for drop-shadow + free positioning that
            next/image's fill mode doesn't support cleanly */}
        <img
          src="/creator-silhouette.png"
          alt=""
          className="relative block w-full opacity-[0.42]"
          style={{
            filter:
              "drop-shadow(0 0 8px oklch(0.75 0.16 250 / 55%)) drop-shadow(0 0 18px oklch(0.8 0.14 85 / 30%))",
          }}
        />
      </div>
    </div>
  );
}
