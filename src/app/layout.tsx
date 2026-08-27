import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pitch Perfect AI",
  description: "Turn your offer into a webinar, VSL, sales page, and launch sequence — in minutes.",
};

// Without this, mobile browsers render the page at a fake ~980px "desktop" layout viewport and
// scale the whole thing down to fit the screen — every button/link is technically there but
// tiny and imprecise to tap, and `window.innerWidth` reports ~980 instead of the phone's real
// width. That second part is what actually broke navigation: the sidebar's own mobile detection
// (src/hooks/use-mobile.tsx) reads window.innerWidth to decide whether to show the off-canvas
// mobile menu vs. the full desktop sidebar — reporting ~980 made it think it was always on
// desktop, even on a phone, so the real device never got the mobile sidebar it already has.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${sora.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
