"use client";

import { useState } from "react";
import { CREDIT_TOPUP_PACKS } from "@/lib/stripe";

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
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold">12-month membership</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Full access to every generator for 12 months, with your monthly credit allotment.
        </p>
        <button
          onClick={startMembershipCheckout}
          disabled={loading === "membership"}
          className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading === "membership" ? "Redirecting..." : hasMembership ? "Renew / manage membership" : "Get 12-month access"}
        </button>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold">Buy more credits</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Need more than your monthly allotment? Top up any time — credits never expire.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CREDIT_TOPUP_PACKS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => startTopupCheckout(pack.id)}
              disabled={loading === pack.id}
              className="rounded-md border border-neutral-300 p-4 text-left hover:border-indigo-400 disabled:opacity-60"
            >
              <div className="font-semibold">{pack.credits} credits</div>
              <div className="text-sm text-neutral-500">${pack.amountUsd}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
