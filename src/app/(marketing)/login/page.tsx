import LoginForm from "./LoginForm";
import CreatorTag from "@/components/CreatorTag";
import LoginBackdrop from "@/components/LoginBackdrop";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    // Explicit dark navy instead of the app's near-black --background default — the brand asks
    // for "dark blue, not black" specifically for this hero, so it's overridden here rather than
    // site-wide. `min-h-screen` (100vh) rather than `min-h-[80vh]` or `min-h-full`: percentage
    // heights need every ancestor in the chain to resolve to a definite height, and in practice
    // `min-h-full` measured as only ~64% of `<main>`'s real (flexbox-computed) height here —
    // confirmed via computed-style inspection, not just visually — leaving a gap that fell
    // through to the app's near-black body background. 100vh sidesteps that whole percentage-
    // resolution chain: it's always at least the full viewport regardless of parent sizing,
    // which costs a little (harmless) extra scroll past the nav bar's height instead.
    <div className="relative min-h-screen overflow-hidden bg-[oklch(0.16_0.05_258)]">
      <LoginBackdrop />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
        <h1 className="mb-6 font-display text-2xl font-semibold text-gradient-silver">Log in</h1>
        <LoginForm next={next || "/dashboard"} />
      </div>
      <CreatorTag />
    </div>
  );
}
