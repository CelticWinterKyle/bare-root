import { requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const user = await requireUser();
  const { priceId } = await req.json() as { priceId: string };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const session = await stripe.checkout.sessions.create({
    customer: user.stripeCustomerId ?? undefined,
    customer_email: user.stripeCustomerId ? undefined : user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    ...(user.hadTrial ? {} : { subscription_data: { trial_period_days: 7 } }),
    success_url: `${appUrl}/settings/billing?success=1`,
    cancel_url: `${appUrl}/pricing`,
    metadata: { userId: user.id },
  });

  return Response.json({ url: session.url });
}
