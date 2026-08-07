"use client";

import { useState } from "react";
import { CREDIT_TOPUP_PACKS } from "@/lib/stripe";
import { Button } from "@/components/ui/button";

export default function BillingActions({ hasMembership }: { hasMembership: boolean }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function startMembershipCheckout() {
    setLoading("membership");
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.assign(data.url);
    setLoading(null);
  }

  async function startTopupCheckout(packId: string) {
    setLoading(packId);
    const res = await fetch("/api/stripe/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId }),
    });
    const data = await res.json();
    if (data.url) window.location.assign(data.url);
    setLoading(null);
  }

  return (
    <div className="space-y-8">
      <div className="card-elevated rounded-2xl p-5">
        <h2 className="font-display font-semibold">12-month membership</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Full access to every generator for 12 months, with your monthly credit allotment.
        </p>
        <Button onClick={startMembershipCheckout} disabled={loading === "membership"} className="mt-4">
          {loading === "membership" ? "Redirecting..." : hasMembership ? "Renew / manage membership" : "Get 12-month access"}
        </Button>
      </div>

      <div className="card-elevated rounded-2xl p-5">
        <h2 className="font-display font-semibold">Buy more credits</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Need more than your monthly allotment? Top up any time — credits never expire.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CREDIT_TOPUP_PACKS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => startTopupCheckout(pack.id)}
              disabled={loading === pack.id}
              className="rounded-xl border border-border bg-card/40 p-4 text-left transition-colors hover:border-primary/40 disabled:opacity-60"
            >
              <div className="font-semibold">{pack.credits} credits</div>
              <div className="text-sm text-muted-foreground">${pack.amountUsd}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
