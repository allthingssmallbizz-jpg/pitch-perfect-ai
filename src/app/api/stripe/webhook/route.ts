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
      let userId = session.metadata?.userId;

      // No self-serve free signup exists — /api/stripe/signup-checkout is the only way to
      // start a *new* membership, and nobody is logged in when they hit it, so there's no
      // userId in metadata yet. Stripe collected their email during its own checkout instead;
      // resolve it to an existing account (e.g. a lapsed member re-subscribing while logged
      // out) or create a brand new one now that payment has actually succeeded.
      if (!userId && session.metadata?.type === "membership") {
        const email = session.customer_details?.email ?? session.customer_email;
        if (email) {
          const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
          if (existing) {
            userId = existing.id;
          } else {
            const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/set-password`;
            const { data: created, error: createErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
            if (!createErr && created.user) userId = created.user.id;
          }
        }
      }
      if (!userId) break;

      if (session.metadata?.type === "membership") {
        const { data: profile } = await admin.from("profiles").select("access_expires_at").eq("id", userId).single();
        const base = profile && new Date(profile.access_expires_at) > new Date() ? new Date(profile.access_expires_at) : new Date();

        await admin
          .from("profiles")
          .update({
            stripe_customer_id: typeof session.customer === "string" ? session.customer : undefined,
            stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
            access_started_at: new Date().toISOString(),
            access_expires_at: addYears(base, 1).toISOString(),
          })
          .eq("id", userId);

        // Payments ledger for the admin member directory's revenue figures — see the comment
        // on the payments table (0010_member_directory.sql). Idempotent on checkout session id
        // the same way the topup path below already is, since Stripe can redeliver webhooks.
        const { data: existingPayment } = await admin
          .from("payments")
          .select("id")
          .eq("stripe_checkout_session_id", session.id)
          .maybeSingle();
        if (!existingPayment) {
          await admin.from("payments").insert({
            user_id: userId,
            type: "membership",
            amount_usd: (session.amount_total ?? 0) / 100,
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
          });
        }
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
            // Mirrored into payments (see 0010_member_directory.sql) so the admin member
            // directory's revenue figures cover top-ups too, not just membership checkouts.
            await admin.from("payments").insert({
              user_id: userId,
              type: "topup",
              amount_usd: (session.amount_total ?? 0) / 100,
              credits,
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

        // Renewals never had a dollar figure recorded anywhere before payments existed —
        // record this one, idempotent via invoice id since Stripe can redeliver webhooks.
        const { data: existingPayment } = await admin
          .from("payments")
          .select("id")
          .eq("stripe_invoice_id", invoice.id)
          .maybeSingle();
        if (!existingPayment) {
          await admin.from("payments").insert({
            user_id: profile.id,
            type: "membership",
            amount_usd: (invoice.amount_paid ?? 0) / 100,
            stripe_invoice_id: invoice.id ?? null,
          });
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
