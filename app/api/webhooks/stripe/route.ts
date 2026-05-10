import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const headerPayload = await headers();
  const sig = headerPayload.get("stripe-signature");

  if (!sig) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      const isPro =
        subscription.status === "active" ||
        subscription.status === "trialing";
      const isTrialing = subscription.status === "trialing";

      await db.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          subscriptionTier: isPro ? "PRO" : "FREE",
          stripeSubscriptionId: subscription.id,
          ...(isTrialing && {
            trialEndsAt: new Date(subscription.trial_end! * 1000),
            hadTrial: true,
          }),
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      await db.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          subscriptionTier: "FREE",
          stripeSubscriptionId: null,
          trialEndsAt: null,
        },
      });
      break;
    }
  }

  return new Response("OK", { status: 200 });
}
