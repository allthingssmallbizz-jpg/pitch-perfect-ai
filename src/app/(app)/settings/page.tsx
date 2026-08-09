import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DisplayNameForm from "./DisplayNameForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const displayName = profile?.full_name || user.email?.split("@")[0] || "";

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-gradient-silver">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage your account.</p>

      <div className="card-elevated mt-8 space-y-5 rounded-2xl p-8">
        <DisplayNameForm initialName={displayName} />
        <div>
          <Label>Email</Label>
          <Input value={user.email ?? ""} readOnly className="mt-1 bg-card/40" />
        </div>
      </div>

      {profile && (
        <div className="card-elevated mt-6 rounded-2xl p-8">
          <h2 className="mb-1 font-semibold">Plan &amp; credits</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {profile.credits_balance} / {profile.credits_monthly_allotment} credits this cycle · access
            renews {new Date(profile.credits_reset_at).toLocaleDateString()}
          </p>
          <Button variant="outline" asChild>
            <Link href="/billing">Manage billing</Link>
          </Button>
        </div>
      )}

      <div className="card-elevated mt-6 rounded-2xl p-8">
        <h2 className="mb-1 font-semibold">Session</h2>
        <p className="mb-4 text-sm text-muted-foreground">Sign out of Pitch Perfect AI on this device.</p>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
