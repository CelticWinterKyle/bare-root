import { requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const user = await requireUser();
  const { priceId } = (await req.json()) as { priceId: string };

  // Guard against silent misconfiguration. Stripe rejects relative
  // success/cancel URLs and empty price IDs with opaque 400s — better
  // to fail loudly here with a useful message.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return Response.json(
      {
        error:
          "Billing not configured: set NEXT_PUBLIC_APP_URL in Vercel env vars.",
      },
      { status: 500 }
    );
  }
  if (!priceId || priceId.length < 4) {
    return Response.json(
      {
        error:
          "Billing not configured: Stripe price IDs missing. Set STRIPE_PRO_MONTHLY_PRICE_ID and STRIPE_PRO_ANNUAL_PRICE_ID.",
      },
      { status: 500 }
    );
  }

  // Always check out against a known Stripe customer. Falling back to
  // customer_email makes Stripe mint a *second* customer, which then
  // orphans the original and can desync subscription state ("paid in
  // Stripe, still Free in app"). Create + persist one if missing.
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { clerkUserId: user.id },
    });
    customerId = customer.id;
    await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    ...(user.hadTrial ? {} : { subscription_data: { trial_period_days: 7 } }),
    success_url: `${appUrl}/settings/billing?success=1`,
    cancel_url: `${appUrl}/pricing`,
    metadata: { userId: user.id },
  });

  return Response.json({ url: session.url });
}
