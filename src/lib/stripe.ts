import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripeClient;
}

// Credit top-up packs. Adjust pricing/quantities to match your real unit economics —
// see the build spec's rule: (cost per generation) × (expected generations/member/month) ×
// (member count) should stay comfortably inside what these packs charge for overage.
export const CREDIT_TOPUP_PACKS = [
  { id: "topup_small", credits: 50, amountUsd: 15 },
  { id: "topup_medium", credits: 150, amountUsd: 35 },
  { id: "topup_large", credits: 400, amountUsd: 79 },
] as const;

export type TopupPackId = (typeof CREDIT_TOPUP_PACKS)[number]["id"];

export function getTopupPack(id: string) {
  return CREDIT_TOPUP_PACKS.find((p) => p.id === id);
}
