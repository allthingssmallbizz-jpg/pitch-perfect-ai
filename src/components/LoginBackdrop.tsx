// Ambient hero background for /login — Aaron Bowe, "The AI Outlaw" and creator of Pitch Perfect
// AI, as a faint silhouette centered directly behind the auth form, flanked by AI-themed
// decorative touches (soft glows, a halo ring behind his head, a constellation/network line
// pattern on both sides) so neither side of the page reads as empty. Everything here is
// `pointer-events-none` and sits behind the page's real content (the page wraps its actual
// content in a `relative z-10` sibling) — purely decorative, never something a screen reader or
// keyboard user needs to reach, so the photo is `aria-hidden`.
//
// public/creator-silhouette.png is pre-processed: grayscale, a "levels" lift (`.linear(0.68,
// 58)`) that raises the hoodie's near-black shadows to a faint mid-gray so the WHOLE figure's
// outline reads at low opacity — not just the bright bits (skin, the white "AI OUTLAW" print,
// the paper) — plus a radial alpha feather baked in so the rectangular image bounds never show a
// hard edge. Rendered here at plain ~30% opacity (no blend mode): sized wide enough that his
// shoulders and arms extend past the card on both sides, which is what actually fills the
// left/right space rather than leaving it blank.
export default function LoginBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Ambient glows — brand-colored, heavily blurred. One centered up top, one on each side
          lower down, so both flanks get a bit of color instead of just the center. */}
      <div
        className="absolute -top-36 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full opacity-[0.14] blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.22 265) 0%, transparent 70%)" }}
      />
      <div
        className="absolute top-[30%] -left-[10%] h-[480px] w-[480px] rounded-full opacity-[0.16] blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.22 265) 0%, transparent 70%)" }}
      />
      <div
        className="absolute -right-[8%] -bottom-[10%] h-[480px] w-[480px] rounded-full opacity-[0.14] blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.62 0.19 300) 0%, transparent 70%)" }}
      />

      {/* A faint halo behind his head/shoulders — two concentric rings, barely visible, the kind
          of quiet geometric touch that reads as "AI aura" without spelling it out. */}
      <div className="absolute top-[8%] left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full border border-primary/25 opacity-50" />
      <div className="absolute top-[11%] left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full border border-primary/15 opacity-50" />

      {/* Constellation / neural-network clusters, one flanking each side — this is what keeps
          the far left/right from ever looking blank, independent of how wide the silhouette
          itself reads on a given screen. */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.22]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        fill="none"
      >
        <g stroke="oklch(0.75 0.1 265)" strokeWidth="1">
          <line x1="90" y1="120" x2="230" y2="70" />
          <line x1="230" y1="70" x2="330" y2="180" />
          <line x1="330" y1="180" x2="230" y2="70" />
          <line x1="90" y1="120" x2="330" y2="180" />
          <line x1="60" y1="420" x2="190" y2="380" />
          <line x1="190" y1="380" x2="170" y2="520" />
          <line x1="60" y1="420" x2="170" y2="520" />
          <line x1="170" y1="520" x2="70" y2="620" />
          <line x1="110" y1="760" x2="230" y2="700" />
          <line x1="230" y1="700" x2="210" y2="840" />
          <line x1="110" y1="760" x2="210" y2="840" />
          <line x1="1250" y1="110" x2="1350" y2="60" />
          <line x1="1350" y1="60" x2="1380" y2="190" />
          <line x1="1250" y1="110" x2="1380" y2="190" />
          <line x1="1280" y1="380" x2="1390" y2="340" />
          <line x1="1390" y1="340" x2="1370" y2="480" />
          <line x1="1280" y1="380" x2="1370" y2="480" />
          <line x1="1370" y1="480" x2="1250" y2="540" />
          <line x1="1230" y1="720" x2="1340" y2="680" />
          <line x1="1340" y1="680" x2="1360" y2="820" />
          <line x1="1230" y1="720" x2="1360" y2="820" />
        </g>
        <g fill="oklch(0.8 0.12 265)">
          <circle cx="90" cy="120" r="3.5" />
          <circle cx="230" cy="70" r="3.5" />
          <circle cx="330" cy="180" r="3.5" />
          <circle cx="60" cy="420" r="3.5" />
          <circle cx="190" cy="380" r="3.5" />
          <circle cx="170" cy="520" r="3.5" />
          <circle cx="70" cy="620" r="3.5" />
          <circle cx="110" cy="760" r="3.5" />
          <circle cx="230" cy="700" r="3.5" />
          <circle cx="210" cy="840" r="3.5" />
          <circle cx="1250" cy="110" r="3.5" />
          <circle cx="1350" cy="60" r="3.5" />
          <circle cx="1380" cy="190" r="3.5" />
          <circle cx="1280" cy="380" r="3.5" />
          <circle cx="1390" cy="340" r="3.5" />
          <circle cx="1370" cy="480" r="3.5" />
          <circle cx="1250" cy="540" r="3.5" />
          <circle cx="1230" cy="720" r="3.5" />
          <circle cx="1340" cy="680" r="3.5" />
          <circle cx="1360" cy="820" r="3.5" />
        </g>
      </svg>

      {/* The silhouette itself — centered directly behind the form, wide enough that his
          shoulders and arms extend past the card on both sides. Hidden below `md`: at narrower
          widths the card runs close to full width, so there's no room for the overflow that
          makes this composition work, and a life-size figure crammed behind a full-width card
          would just look like clutter. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative background art, not
          the page's LCP element; needs a raw <img> for free positioning that next/image's fill
          mode doesn't support cleanly */}
      <img
        src="/creator-silhouette.png"
        alt=""
        className="absolute top-[-9%] left-1/2 hidden w-[52vw] max-w-[820px] -translate-x-1/2 opacity-30 md:block"
      />
    </div>
  );
}
