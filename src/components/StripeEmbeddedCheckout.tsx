import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createStripeCheckoutSession } from "@/utils/payments.functions";
import type { Cycle } from "@/lib/pricing";

/** Stripe Embedded Checkout — international credit/debit cards. */
export function StripeEmbeddedCheckoutBox({ cycle }: { cycle: Cycle }) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createStripeCheckoutSession({
      data: {
        cycle,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
    return result.clientSecret;
  };

  return (
    <div id="checkout" style={{ marginTop: 16, background: "#fff", borderRadius: 4, padding: 4 }}>
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
