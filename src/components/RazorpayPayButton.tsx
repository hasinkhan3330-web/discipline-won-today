import { useState } from "react";
import { toast } from "sonner";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/razorpay.functions";
import { PRICING, type Cycle } from "@/lib/pricing";

const G = "#00d4ff";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (x: unknown) => void) => void };
  }
}

function loadCheckout(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("unavailable"));
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay checkout."));
    document.body.appendChild(s);
  });
}

/** Razorpay Standard Checkout button — the web payment path. */
export function RazorpayPayButton({
  cycle,
  email,
  method,
  onSuccess,
}: {
  cycle: Cycle;
  email?: string | null;
  /** Preselected Razorpay method block: UPI or cards/netbanking. */
  method?: "upi" | "card";
  onSuccess?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    setBusy(true);
    try {
      // Store-policy guard: web checkout must never open inside a native shell.
      const { detectPlatform, isNativeStore } = await import("@/lib/platform");
      if (isNativeStore(await detectPlatform())) {
        throw new Error("In-app purchases are handled by the app store on this device.");
      }
      await loadCheckout();
      const order = await createRazorpayOrder({ data: { cycle } });
      if ("error" in order) throw new Error(order.error);

      await new Promise<void>((resolve) => {
        const rzp = new window.Razorpay!({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: "AXEN Habit & Discipline",
          description: `AXEN PRO · ${cycle.toUpperCase()} — ${PRICING[cycle].display}`,
          prefill: email ? { email } : undefined,
          theme: { color: G },
          ...(method ? { config: { display: { blocks: {}, preferences: { show_default_blocks: true } } }, method: { upi: method === "upi", card: method === "card", netbanking: method === "card", wallet: method === "card" } } : {}),
          modal: {
            ondismiss: () => {
              toast.message("Checkout closed", { description: "You were not charged." });
              resolve();
            },
          },
          handler: async (r: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            const res = await verifyRazorpayPayment({ data: { ...r, cycle } });
            if (!res.active) {
              toast.error("Payment not verified", { description: res.error ?? "Please contact support." });
            } else {
              toast.success("Payment successful", { description: "AXEN PRO unlocked." });
              window.dispatchEvent(new Event("subscription:refresh"));
              onSuccess?.();
            }
            resolve();
          },
        } as Record<string, unknown>);
        rzp.on("payment.failed", () => {
          toast.error("Payment failed", { description: "No charge was made. Try again." });
          resolve();
        });
        rzp.open();
      });
    } catch (e) {
      toast.error("Couldn't start checkout", {
        description: e instanceof Error ? e.message : "Try again in a moment.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={pay}
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
      {busy ? "◌ OPENING CHECKOUT…" : `PAY ${PRICING[cycle].display.toUpperCase()}`}
    </button>
  );
}
