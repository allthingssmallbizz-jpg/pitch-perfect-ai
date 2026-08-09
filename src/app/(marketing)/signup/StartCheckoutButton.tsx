"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function StartCheckoutButton() {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/signup-checkout", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        toast.error(data?.error || "Could not start checkout. Try again.");
        setLoading(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      toast.error("Network error — try again.");
      setLoading(false);
    }
  }

  return (
    <Button onClick={startCheckout} disabled={loading} className="w-full">
      {loading ? "Redirecting to checkout..." : "Continue to secure checkout"}
    </Button>
  );
}
