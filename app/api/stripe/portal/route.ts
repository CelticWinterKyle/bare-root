import { requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

export async function POST() {
  const user = await requireUser();

  // Self-heal a missing customer id (e.g. from an old orphaned-customer
  // race) by looking the customer up by email and persisting it, so a Pro
  // user is never stranded without a way to manage billing.
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const found = await stripe.customers.list({ email: user.email, limit: 1 });
    if (found.data[0]) {
      customerId = found.data[0].id;
      await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }
  }
  if (!customerId) {
    return new Response("No billing account", { status: 400 });
  }

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

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/settings/billing`,
  });

  return Response.json({ url: session.url });
}
