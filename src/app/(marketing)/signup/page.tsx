import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import StartCheckoutButton from "./StartCheckoutButton";

function formatPrice(unitAmount: number | null, currency: string) {
  if (unitAmount === null) return null;
  return (unitAmount / 100).toLocaleString(undefined, { style: "currency", currency, minimumFractionDigits: 0 });
}

async function getMembershipPrice() {
  const priceId = process.env.STRIPE_MEMBERSHIP_PRICE_ID;
  if (!priceId) return null;
  try {
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId);
    return {
      amount: formatPrice(price.unit_amount, price.currency),
      interval: price.recurring?.interval ?? null,
    };
  } catch {
    return null;
  }
}

async function getPaidEmail(sessionId: string | undefined) {
  if (!sessionId) return null;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session.customer_details?.email ?? session.customer_email ?? null;
  } catch {
    return null;
  }
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const { checkout, session_id } = await searchParams;

  if (checkout === "success") {
    const email = await getPaidEmail(session_id);
    return (
      <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
        <h1 className="mb-4 font-display text-2xl font-semibold text-gradient-silver">You&apos;re in!</h1>
        <div className="card-elevated rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-sm text-emerald-300">
          Payment received{email ? ` for ${email}` : ""}. We&apos;ve sent an email with a link to
          set your password — click it to finish setting up your account and get to your
          dashboard. (Didn&apos;t get it in a minute or two? Check spam, or reach out.)
        </div>
      </div>
    );
  }

  const price = await getMembershipPrice();

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <h1 className="mb-2 font-display text-2xl font-semibold text-gradient-silver">Get started</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        12 months of access to every Pitch Perfect AI generator.
      </p>

      {checkout === "cancelled" && (
        <p className="mb-4 rounded-lg border border-border bg-card/40 px-4 py-2 text-sm text-muted-foreground">
          Checkout was cancelled — no charge was made.
        </p>
      )}

      <div className="card-elevated space-y-4 rounded-2xl p-8">
        <div>
          <div className="text-3xl font-semibold">
            {price?.amount ?? "Membership"}
            {price?.interval && <span className="text-base font-normal text-muted-foreground">/{price.interval}</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Full access to every generator for 12 months, plus your monthly credit allotment.
          </p>
        </div>

        <StartCheckoutButton />

        <p className="text-center text-xs text-muted-foreground">
          You&apos;ll pay first, on Stripe&apos;s secure checkout. Once payment goes through,
          we&apos;ll email you a link to set your password and log in — there&apos;s no separate
          account to create.
        </p>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
