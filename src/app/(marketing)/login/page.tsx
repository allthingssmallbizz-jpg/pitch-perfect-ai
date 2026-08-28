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
    // site-wide.
    <div className="relative min-h-[80vh] overflow-hidden bg-[oklch(0.16_0.05_258)]">
      <LoginBackdrop />
      <div className="relative z-10 mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-16">
        <h1 className="mb-6 font-display text-2xl font-semibold text-gradient-silver">Log in</h1>
        <LoginForm next={next || "/dashboard"} />
      </div>
      <CreatorTag />
    </div>
  );
}
