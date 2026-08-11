"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);

    const supabase = createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/set-password`,
    });
    setSending(false);

    // Always show success, even on a real error — otherwise this becomes a way to check which
    // emails have accounts. The reset email itself won't arrive for a nonexistent address, which
    // is the correct, unobservable outcome either way.
    if (resetError) {
      console.error(resetError);
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card-elevated rounded-2xl p-8 text-sm">
        <p className="text-emerald-400">
          If an account exists for <strong>{email}</strong>, a reset link is on its way.
        </p>
        <p className="mt-2 text-muted-foreground">
          Check your inbox (and spam folder). The link expires after a while, so use it soon.
        </p>
        <Link href="/login" className="mt-4 inline-block text-primary hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card-elevated space-y-4 rounded-2xl p-8">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1"
        />
      </div>
      <Button type="submit" disabled={sending} className="w-full">
        {sending ? "Sending..." : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
