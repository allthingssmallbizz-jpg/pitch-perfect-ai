import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { formatCreditsLabel } from "@/lib/credits";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DisplayNameForm from "./DisplayNameForm";
import ChangePasswordForm from "./ChangePasswordForm";
import GhlConnectionForm from "./GhlConnectionForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const displayName = profile?.full_name || user.email?.split("@")[0] || "";

  const { data: ghlConnection } = await supabase
    .from("ghl_connections")
    .select("location_id, api_token")
    .eq("user_id", user.id)
    .maybeSingle();

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

      <div className="card-elevated mt-6 rounded-2xl p-8">
        <h2 className="mb-1 font-semibold">Password</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Change your password — useful if you&apos;re still using a temporary one an admin set for you.
        </p>
        <ChangePasswordForm />
      </div>

      {profile && (
        <div className="card-elevated mt-6 rounded-2xl p-8">
          <h2 className="mb-1 font-semibold">Plan &amp; credits</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {formatCreditsLabel(profile)} credits this cycle · access renews{" "}
            {new Date(profile.credits_reset_at).toLocaleDateString()}
          </p>
          <Button variant="outline" asChild>
            <Link href="/billing">Manage billing</Link>
          </Button>
        </div>
      )}

      <div className="card-elevated mt-6 rounded-2xl p-8">
        <h2 className="mb-1 font-semibold">Go High Level</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Connect your GHL sub-account once and every opt-in form on your published Landing Pages
          automatically adds the lead to your CRM and tags it — which is what triggers any
          Workflow/Automation you&apos;ve set up on that tag in Go High Level.
        </p>
        <GhlConnectionForm
          initialLocationId={ghlConnection?.location_id ?? ""}
          isConnected={Boolean(ghlConnection?.api_token)}
        />
      </div>

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
