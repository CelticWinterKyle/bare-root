import { requireUser } from "@/lib/auth";
import { BillingClient } from "@/components/settings/BillingClient";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const user = await requireUser();
  const { success } = await searchParams;

  const isPro = user.subscriptionTier === "PRO";
  const trialEndsAt = user.trialEndsAt?.toISOString() ?? null;

  return (
    <BillingClient
      isPro={isPro}
      hadTrial={user.hadTrial}
      trialEndsAt={trialEndsAt}
      hasStripeCustomer={!!user.stripeCustomerId}
      justUpgraded={success === "1"}
      monthlyPriceId={process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? ""}
      annualPriceId={process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? ""}
    />
  );
}
