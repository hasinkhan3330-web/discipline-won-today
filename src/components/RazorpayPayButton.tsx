import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { loadRazorpayCheckout, openRazorpayCheckout } from "@/lib/razorpay";
import { createPaymentOrder, verifyPaymentSignature } from "@/utils/payments.functions";

interface RazorpayPayButtonProps {
  priceKey: string;
  email?: string | null;
  displayName?: string | null;
  label?: string;
  onSuccess?: () => void;
}

const G = "#00d4ff";

/**
 * Razorpay Standard Checkout (one-time order).
 * The order is created server-side, the signature is verified server-side,
 * and access is granted only once the `payment.captured` webhook lands.
 */
export function RazorpayPayButton({
  priceKey,
  email,
  displayName,
  label = "PAY & UNLOCK DWT PRO",
  onSuccess,
}: RazorpayPayButtonProps) {
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    loadRazorpayCheckout().catch(() => { /* retried on click */ });
    return () => { mounted.current = false; };
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      await loadRazorpayCheckout();
      const order = await createPaymentOrder({ data: { priceKey } });
      if ("error" in order) throw new Error(order.error);

      openRazorpayCheckout({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "DWT — Discipline Won Today",
        description: priceKey.includes("yearly") ? "DWT PRO · Yearly" : "DWT PRO · Monthly",
        prefill: {
          ...(email ? { email } : {}),
          ...(displayName ? { name: displayName } : {}),
        },
        theme: { color: G },
        handler: async (res) => {
          if (mounted.current) { setWaiting(true); setBusy(false); }
          try {
            const check = await verifyPaymentSignature({
              data: {
                orderId: res.razorpay_order_id ?? order.orderId,
                paymentId: res.razorpay_payment_id,
                signature: res.razorpay_signature,
              },
            });
            if ("error" in check) throw new Error(check.error);
            if (!check.verified) throw new Error("Payment signature could not be verified.");
            toast.success("Payment received", { description: "Unlocking your account…" });
          } catch (e) {
            toast.error("Verification issue", {
              description: e instanceof Error ? e.message : "We'll confirm shortly.",
            });
          }
          // Access is granted by the payment.captured webhook — poll for it.
          window.dispatchEvent(new Event("subscription:refresh"));
          if (onSuccess) onSuccess();
        },
        modal: {
          ondismiss: () => {
            if (mounted.current) setBusy(false);
            toast.message("Checkout closed", { description: "Your card was not charged." });
          },
        },
      });
    } catch (e) {
      toast.error("Couldn't start checkout", {
        description: e instanceof Error ? e.message : "Try again in a moment.",
      });
      if (mounted.current) setBusy(false);
    }
  };

  const disabled = busy || waiting;

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        style={{
          marginTop: 20, width: "100%", padding: "16px 20px",
          background: disabled ? "#333" : G, color: disabled ? "#888" : "#000",
          fontWeight: 900, letterSpacing: 3, fontSize: 13,
          border: "none", borderRadius: 2, fontFamily: "monospace",
          cursor: disabled ? "wait" : "pointer",
          boxShadow: disabled ? "none" : `0 0 28px ${G}77`,
        }}
      >
        {waiting ? "◌ CONFIRMING PAYMENT…" : busy ? "◌ OPENING CHECKOUT…" : label}
      </button>
      {waiting && (
        <p style={{ marginTop: 10, fontSize: 10, color: "#888", letterSpacing: 1, textAlign: "center", fontFamily: "monospace" }}>
          Waiting for Razorpay to confirm the capture. This unlocks automatically.
        </p>
      )}
    </>
  );
}
