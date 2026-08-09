import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

// The *only* way a new member account gets created — there's no free self-serve signup form.
// Nobody is logged in yet here, so unlike /api/stripe/checkout (which requires an existing
// session and stamps metadata.userId), this has no user to attach to the session. Stripe
// collects their email during its own hosted checkout instead; the webhook (checkout.session.
// completed) resolves that email to an existing account or creates a brand new one via
// supabase.auth.admin.inviteUserByEmail once payment actually succeeds — see the comment there.
export async function POST() {
  const priceId = process.env.STRIPE_MEMBERSHIP_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "Billing isn't configured yet (STRIPE_MEMBERSHIP_PRICE_ID missing)." }, { status: 500 });
  }

  try {
    const stripe = getStripe();
    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/signup?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/signup?checkout=cancelled`,
      metadata: { type: "membership" },
      subscription_data: { metadata: { type: "membership" } },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start checkout.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
