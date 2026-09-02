import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createPayPalOrder, capturePayPalOrder } from "@/lib/paypal.functions";
import { USD_DISPLAY, type Cycle } from "@/lib/pricing";

const G = "#00d4ff";

declare global {
  interface Window {
    paypal?: any;
  }
}

function loadSdk(clientId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("unavailable"));
    if (window.paypal) return resolve();
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load PayPal checkout."));
    document.body.appendChild(s);
  });
}

/** PayPal Smart Buttons — web-only international payment path. */
export function PayPalPayButton({
  clientId,
  cycle,
  onSuccess,
}: {
  clientId: string;
  cycle: Cycle;
  onSuccess?: () => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    // Store-policy guard: PayPal must never render inside a native shell.
    (async () => {
      const { detectPlatform, isNativeStore } = await import("@/lib/platform");
      if (isNativeStore(await detectPlatform())) return;
      if (!alive) return;
      await loadSdk(clientId)
      .then(() => {
        if (!alive || !host.current) return;
        host.current.innerHTML = "";
        window.paypal
          .Buttons({
            style: { layout: "vertical", color: "black", shape: "rect", label: "paypal" },
            createOrder: async () => {
              const res = await createPayPalOrder({ data: { cycle } });
              if ("error" in res) throw new Error(res.error);
              return res.orderId;
            },
            onApprove: async (data: { orderID: string }) => {
              const res = await capturePayPalOrder({ data: { orderId: data.orderID, cycle } });
              if (!res.active) {
                toast.error("Payment not verified", { description: res.error ?? "Please contact support." });
                return;
              }
              toast.success("Payment successful", { description: "AXEN PRO unlocked." });
              window.dispatchEvent(new Event("subscription:active"));
              window.dispatchEvent(new Event("subscription:refresh"));
              onSuccess?.();
            },
            onCancel: () => toast.message("Checkout closed", { description: "You were not charged." }),
            onError: () => toast.error("Payment failed", { description: "No charge was made. Try again." }),
          })
          .render(host.current);
        setReady(true);
      })
      .catch(() =>
        toast.error("Couldn't load PayPal", {
          description: "Payment system loading… Please try again shortly.",
        }),
      );
    })();
    return () => {
      alive = false;
    };
  }, [clientId, cycle, onSuccess]);

  return (
    <div style={{ marginTop: 20 }}>
      <div ref={host} />
      {!ready && (
        <div style={{ fontSize: 10, letterSpacing: 3, color: G, textAlign: "center", padding: 12 }}>
          ◌ LOADING PAYPAL…
        </div>
      )}
      <p style={{ marginTop: 8, fontSize: 9, color: "#666", letterSpacing: 1, textAlign: "center" }}>
        Charged {USD_DISPLAY[cycle]} by PayPal.
      </p>
    </div>
  );
}
