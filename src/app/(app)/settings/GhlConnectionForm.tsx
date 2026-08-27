"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { updateGhlConnection, disconnectGhl } from "@/lib/actions/ghlConnection";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";

export default function GhlConnectionForm({
  initialLocationId,
  isConnected,
}: {
  initialLocationId: string;
  isConnected: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateGhlConnection, undefined);
  const [disconnecting, startDisconnect] = useTransition();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  return (
    <div>
      {isConnected && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Connected — every opt-in form on your published Landing Pages sends leads here.
        </p>
      )}
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="location_id">Location ID</Label>
          <Input
            id="location_id"
            name="location_id"
            defaultValue={initialLocationId}
            placeholder="e.g. ve9EPM428h8vShlRW1KT"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Found in your GHL sub-account under Settings → Business Profile (or in the URL when
            you&apos;re inside that sub-account).
          </p>
        </div>
        <div>
          <Label htmlFor="api_token">Private Integration token</Label>
          <PasswordInput
            id="api_token"
            name="api_token"
            placeholder={isConnected ? "•••••••••••••••• (leave as-is or paste a new one)" : "Paste your token here"}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            In your GHL sub-account: Settings → Private Integrations → Create new integration.
            Give it Contacts (read/write) and Workflows access, then paste the token it generates
            here — GHL only shows it once.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : isConnected ? "Update connection" : "Connect Go High Level"}
          </Button>
          {isConnected && !confirmingDisconnect && (
            <Button type="button" variant="ghost" onClick={() => setConfirmingDisconnect(true)}>
              Disconnect
            </Button>
          )}
          {isConnected && confirmingDisconnect && (
            <>
              <span className="text-sm text-muted-foreground">Remove this connection?</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={disconnecting}
                onClick={() => startDisconnect(() => disconnectGhl())}
              >
                {disconnecting ? "Removing..." : "Yes, disconnect"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDisconnect(false)}>
                Cancel
              </Button>
            </>
          )}
        </div>
        {state && "success" in state && state.success && (
          <p className="text-sm text-emerald-400">Saved — new form submissions will sync from now on.</p>
        )}
        {state && "error" in state && state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </form>
    </div>
  );
}
