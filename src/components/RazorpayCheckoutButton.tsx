import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { loadRazorpayCheckout, openRazorpayCheckout } from "@/lib/razorpay";
import { createSubscription, getPaymentConfig, syncSubscription } from "@/utils/payments.functions";

interface RazorpayCheckoutButtonProps {
  priceKey: string;
  email?: string | null;
  displayName?: string | null;
  label?: string;
  onSuccess?: () => void;
}

const G = "#00d4ff";

export function RazorpayCheckoutButton({
  priceKey,
  email,
  displayName,
  label = "START 3-DAY FREE TRIAL",
  onSuccess,
}: RazorpayCheckoutButtonProps) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // Warm the checkout script so the modal opens instantly on tap.
    loadRazorpayCheckout().catch(() => { /* retried on click */ });
    return () => { mounted.current = false; };
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      await loadRazorpayCheckout();
      const config = await getPaymentConfig();
      const created = await createSubscription({ data: { priceKey } });
      if ("error" in created) throw new Error(created.error);

      openRazorpayCheckout({
        key: created.keyId || config.keyId,
        subscription_id: created.subscriptionId,
        name: "DWT — Discipline Won Today",
        description: priceKey.includes("yearly") ? "DWT PRO · Yearly" : "DWT PRO · Monthly",
        prefill: {
          ...(email ? { email } : {}),
          ...(displayName ? { name: displayName } : {}),
        },
        theme: { color: G },
        handler: async () => {
          try {
            await syncSubscription({ data: { subscriptionId: created.subscriptionId } });
          } catch { /* the webhook is the source of truth anyway */ }
          window.dispatchEvent(new Event("subscription:refresh"));
          if (onSuccess) onSuccess();
          else window.location.href = "/checkout/success";
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

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      style={{
        marginTop: 20, width: "100%", padding: "16px 20px",
        background: busy ? "#333" : G, color: busy ? "#888" : "#000",
        fontWeight: 900, letterSpacing: 3, fontSize: 13,
        border: "none", borderRadius: 2, fontFamily: "monospace",
        cursor: busy ? "wait" : "pointer",
        boxShadow: busy ? "none" : `0 0 28px ${G}77`,
      }}
    >
      {busy ? "◌ OPENING CHECKOUT…" : label}
    </button>
  );
}
