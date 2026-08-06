import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const stripe = getStripe();
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId) break;

      if (session.metadata?.type === "membership") {
        const { data: profile } = await admin.from("profiles").select("access_expires_at").eq("id", userId).single();
        const base = profile && new Date(profile.access_expires_at) > new Date() ? new Date(profile.access_expires_at) : new Date();

        await admin
          .from("profiles")
          .update({
            stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
            access_started_at: new Date().toISOString(),
            access_expires_at: addYears(base, 1).toISOString(),
          })
          .eq("id", userId);
      }

      if (session.metadata?.type === "topup") {
        const credits = Number(session.metadata?.credits || 0);
        if (credits > 0) {
          // Idempotency: skip if we've already recorded this checkout session.
          const { data: existing } = await admin
            .from("credit_topups")
            .select("id")
            .eq("stripe_checkout_session_id", session.id)
            .maybeSingle();

          if (!existing) {
            const { data: profile } = await admin.from("profiles").select("credits_balance").eq("id", userId).single();
            if (profile) {
              await admin
                .from("profiles")
                .update({ credits_balance: profile.credits_balance + credits })
                .eq("id", userId);
            }
            await admin.from("credit_topups").insert({
              user_id: userId,
              credits,
              amount_usd: (session.amount_total ?? 0) / 100,
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
            });
          }
        }
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof invoice.parent?.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : null;
      if (!subscriptionId) break;

      const { data: profile } = await admin
        .from("profiles")
        .select("id, access_expires_at")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();

      // Skip the very first invoice — checkout.session.completed already set the window.
      if (profile && invoice.billing_reason === "subscription_cycle") {
        const base = new Date(profile.access_expires_at) > new Date() ? new Date(profile.access_expires_at) : new Date();
        await admin
          .from("profiles")
          .update({ access_expires_at: addYears(base, 1).toISOString() })
          .eq("id", profile.id);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
