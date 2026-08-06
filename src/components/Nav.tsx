import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";

export default async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let credits: number | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, credits_balance")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
    credits = profile?.credits_balance ?? null;
  }

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight text-lg">
          Pitch Perfect <span className="text-indigo-600">AI</span>
        </Link>

        <nav className="flex items-center gap-5 text-sm">
          {user ? (
            <>
              <Link href="/dashboard" className="hover:text-indigo-600">
                Dashboard
              </Link>
              <Link href="/billing" className="hover:text-indigo-600">
                Billing
              </Link>
              {isAdmin && (
                <Link href="/admin" className="hover:text-indigo-600">
                  Admin
                </Link>
              )}
              {credits !== null && (
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">
                  {credits} credits
                </span>
              )}
              <form action={signOut}>
                <button className="text-neutral-500 hover:text-neutral-900" type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-indigo-600">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-500"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
