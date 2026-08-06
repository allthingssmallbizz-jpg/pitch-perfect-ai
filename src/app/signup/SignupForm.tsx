"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/actions/auth";

export default function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, undefined);

  if (state && "success" in state && state.success) {
    return <p className="rounded-md bg-green-50 p-4 text-green-800">{state.message}</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700" htmlFor="fullName">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-neutral-500">At least 8 characters.</p>
      </div>

      {state && "error" in state && state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? "Creating account..." : "Create account"}
      </button>

      <p className="text-center text-sm text-neutral-500">
        Already have an account? <Link href="/login" className="text-indigo-600 hover:underline">Log in</Link>
      </p>
    </form>
  );
}
