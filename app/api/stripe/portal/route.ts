import { requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const user = await requireUser();

  if (!user.stripeCustomerId) {
    return new Response("No billing account", { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl}/settings/billing`,
  });

  return Response.json({ url: session.url });
}
