"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, undefined);

  if (state && "success" in state && state.success) {
    return (
      <div className="card-elevated rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-300">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="card-elevated space-y-4 rounded-2xl p-8">
      <div>
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" type="text" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" minLength={8} required className="mt-1" />
        <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
      </div>

      {state && "error" in state && state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account..." : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
