import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY env var");
  process.exit(1);
}

const stripe = new Stripe(key);

const wh = await stripe.webhookEndpoints.create({
  url: "https://bare-root.vercel.app/api/webhooks/stripe",
  enabled_events: [
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ],
});

console.log("Webhook ID:", wh.id);
console.log("Signing secret:", wh.secret);
