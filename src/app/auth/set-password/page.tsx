"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status = "checking" | "ready" | "invalid";

export default function SetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function establishSession() {
      // Invite links can't use the PKCE ?code= flow (the browser that sends the invite isn't
      // the one that opens it — see inviteUserByEmail's docs), so Supabase lands here with the
      // session tokens in the URL fragment instead of a query param.
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        window.history.replaceState(null, "", window.location.pathname);
        setStatus(sessionError ? "invalid" : "ready");
        return;
      }

      // Page refresh after the tokens were already consumed once.
      const { data } = await supabase.auth.getUser();
      setStatus(data.user ? "ready" : "invalid");
    }

    establishSession();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <h1 className="mb-6 font-display text-2xl font-semibold text-gradient-silver">Set your password</h1>

      {status === "checking" && <p className="text-sm text-muted-foreground">Confirming your invite...</p>}

      {status === "invalid" && (
        <div className="card-elevated rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          This invite link is invalid or has expired. Ask whoever invited you to send a new one,
          or{" "}
          <a href="/login" className="underline">
            log in
          </a>{" "}
          if you already have a password.
        </div>
      )}

      {status === "ready" && (
        <form onSubmit={handleSubmit} className="card-elevated space-y-4 rounded-2xl p-8">
          <p className="text-sm text-muted-foreground">
            Welcome! Choose a password to finish setting up your account.
          </p>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              minLength={8}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving..." : "Set password & continue"}
          </Button>
        </form>
      )}
    </div>
  );
}
