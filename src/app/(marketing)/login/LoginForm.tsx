"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

const REMEMBERED_EMAIL_KEY = "pitchperfectai_login_email";

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, undefined);
  const emailRef = useRef<HTMLInputElement>(null);

  // Prefill with whatever email last logged in from this browser, so returning members don't
  // retype it every visit — never for the password, that's still typed fresh each time.
  useEffect(() => {
    const remembered = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (remembered && emailRef.current) emailRef.current.value = remembered;
  }, []);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        const email = emailRef.current?.value.trim();
        if (email) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }}
      className="card-elevated space-y-4 rounded-2xl p-8"
    >
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required ref={emailRef} className="mt-1" />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <PasswordInput id="password" name="password" required className="mt-1" />
      </div>

      {state && "error" in state && state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in..." : "Log in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
