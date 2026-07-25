import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: {
    priceId: string;
    userId: string;
    customerEmail?: string;
    successUrl?: string;
    onCompleted?: () => void;
    onClosed?: () => void;
  }) => {
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(options.priceId);

      // Re-initialize with an eventCallback so we can react to overlay events
      // (checkout.completed fires immediately on success; useful for refetches
      // when the user closes the overlay before the successUrl redirect).
      window.Paddle.Update?.({
        eventCallback: (event: any) => {
          if (event?.name === "checkout.completed") options.onCompleted?.();
          if (event?.name === "checkout.closed") options.onClosed?.();
        },
      });

      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: { userId: options.userId },
        settings: {
          displayMode: "overlay",
          theme: "dark",
          successUrl: options.successUrl || `${window.location.origin}/checkout/success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
