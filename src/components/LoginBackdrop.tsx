// Ambient hero background for /login (and reused on /signup) — Aaron Bowe, "The AI Outlaw" and
// creator of Pitch Perfect AI, as a faint silhouette behind the auth form, plus a few very quiet
// AI-themed decorative touches (a constellation/network line pattern, two soft glows). Everything
// here is `pointer-events-none` and sits behind the page's real content (z-0 vs. the form's
// z-10) — purely decorative, never something a screen reader or keyboard user needs to reach, so
// the photo is `aria-hidden`.
//
// public/creator-silhouette.png is pre-processed (grayscale + a radial alpha feather baked in so
// the rectangular image bounds never show a hard edge) — see the one-off script that generated
// it. `mix-blend-mode: screen` over the page's near-black background means only the lighter
// tones (face, glasses highlights, the shirt's "AI OUTLAW" print) read through at all; the blacks
// in the photo contribute nothing and just disappear into the page. Combined with the low opacity
// below, the result is "you can tell someone's there" rather than a normal photo.
export default function LoginBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Two soft ambient glows — brand-colored, heavily blurred, barely-there depth rather than
          a flat black void behind the figure. */}
      <div
        className="absolute -top-24 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full opacity-[0.16] blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.22 265) 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-15%] left-[8%] h-[420px] w-[420px] rounded-full opacity-[0.12] blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.6 0.2 300) 0%, transparent 70%)" }}
      />

      {/* Faint constellation / neural-network pattern — nodes and connecting lines, low enough
          opacity to read as texture, not a foreground graphic. */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.14]"
        viewBox="0 0 800 1000"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g stroke="oklch(0.75 0.1 265)" strokeWidth="1">
          <line x1="90" y1="140" x2="230" y2="90" />
          <line x1="230" y1="90" x2="340" y2="200" />
          <line x1="340" y1="200" x2="230" y2="90" />
          <line x1="90" y1="140" x2="340" y2="200" />
          <line x1="600" y1="120" x2="720" y2="220" />
          <line x1="600" y1="120" x2="500" y2="230" />
          <line x1="500" y1="230" x2="640" y2="330" />
          <line x1="720" y1="220" x2="640" y2="330" />
          <line x1="60" y1="760" x2="180" y2="700" />
          <line x1="180" y1="700" x2="150" y2="860" />
          <line x1="60" y1="760" x2="150" y2="860" />
          <line x1="650" y1="780" x2="740" y2="860" />
          <line x1="650" y1="780" x2="560" y2="870" />
          <line x1="560" y1="870" x2="740" y2="860" />
        </g>
        <g fill="oklch(0.8 0.12 265)">
          <circle cx="90" cy="140" r="3.5" />
          <circle cx="230" cy="90" r="3.5" />
          <circle cx="340" cy="200" r="3.5" />
          <circle cx="600" cy="120" r="3.5" />
          <circle cx="720" cy="220" r="3.5" />
          <circle cx="500" cy="230" r="3.5" />
          <circle cx="640" cy="330" r="3.5" />
          <circle cx="60" cy="760" r="3.5" />
          <circle cx="180" cy="700" r="3.5" />
          <circle cx="150" cy="860" r="3.5" />
          <circle cx="650" cy="780" r="3.5" />
          <circle cx="740" cy="860" r="3.5" />
          <circle cx="560" cy="870" r="3.5" />
        </g>
      </svg>

      {/* The silhouette itself — anchored to the right side rather than centered, so the "AI
          OUTLAW" print on his shirt actually reads instead of landing directly behind the
          (opaque) card. Hidden below `lg` — at narrower widths the card runs close to full width
          and there's no clear side for a life-size figure to stand in without just looking like
          clutter behind the form, so it drops out entirely rather than fighting the layout. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative background art, not
          the page's LCP element; needs a raw <img> for mix-blend-mode + free positioning that
          next/image's fill mode doesn't support cleanly */}
      <img
        src="/creator-silhouette.png"
        alt=""
        className="absolute top-[5%] right-[1%] hidden h-[90%] w-auto max-w-none opacity-[0.28] lg:block"
        style={{ mixBlendMode: "screen" }}
      />
    </div>
  );
}
