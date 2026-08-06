import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, getTopupPack } from "@/lib/stripe";

export const runtime = "nodejs";

const bodySchema = z.object({ packId: z.string() });

// Creates a one-off Checkout Session for a credit top-up pack. This is the "overuse pays
// you instead of costing you" mechanic from the build spec.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const pack = getTopupPack(parsed.data.packId);
  if (!pack) return NextResponse.json({ error: "Unknown top-up pack" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const stripe = getStripe();

  let customerId = profile.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: profile.email, metadata: { userId: user.id } });
    customerId = customer.id;
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(pack.amountUsd * 100),
          product_data: { name: `${pack.credits} credits — Pitch Perfect AI` },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/billing?checkout=success`,
    cancel_url: `${origin}/billing?checkout=cancelled`,
    metadata: { type: "topup", userId: user.id, packId: pack.id, credits: String(pack.credits) },
  });

  return NextResponse.json({ url: session.url });
}
