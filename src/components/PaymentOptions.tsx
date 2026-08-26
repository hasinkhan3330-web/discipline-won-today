import { useState } from "react";
import { RazorpayPayButton } from "@/components/RazorpayPayButton";
import { StripeEmbeddedCheckoutBox } from "@/components/StripeEmbeddedCheckout";
import { isStripeConfigured } from "@/lib/stripe";
import { PRICING, STRIPE_DISPLAY, type Cycle } from "@/lib/pricing";

const G = "#00d4ff";
const G2 = "#a855f7";

type Method = "razorpay" | "stripe";

/** Web checkout — user chooses Razorpay (India) or Stripe (international cards). */
export function PaymentOptions({ cycle, email }: { cycle: Cycle; email?: string | null }) {
  const stripeReady = isStripeConfigured();
  const [method, setMethod] = useState<Method>("razorpay");

  const options: { id: Method; title: string; sub: string; price: string }[] = [
    {
      id: "razorpay",
      title: "RAZORPAY",
      sub: "UPI · Cards · Netbanking (India)",
      price: PRICING[cycle].display,
    },
    {
      id: "stripe",
      title: "STRIPE",
      sub: "International credit / debit cards",
      price: STRIPE_DISPLAY[cycle],
    },
  ].filter((o) => o.id !== "stripe" || stripeReady);

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 10, letterSpacing: 3, color: "#777" }}>◈ CHOOSE PAYMENT METHOD</div>

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map((o) => {
          const active = method === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setMethod(o.id)}
              style={{
                textAlign: "left", padding: 14, cursor: "pointer",
                background: active ? `linear-gradient(135deg, ${G}1c, ${G2}1c)` : "rgba(10,10,25,0.7)",
                border: `1px solid ${active ? G : "#333"}`,
                borderRadius: 4, color: "#fff", fontFamily: "monospace",
                boxShadow: active ? `0 0 16px ${G}44` : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ letterSpacing: 3, fontWeight: 900, fontSize: 12 }}>{o.title}</div>
                <div style={{ fontSize: 11, color: G, fontWeight: 900 }}>{o.price}</div>
              </div>
              <div style={{ marginTop: 5, fontSize: 10, color: "#888", letterSpacing: 1 }}>{o.sub}</div>
            </button>
          );
        })}
      </div>

      {method === "razorpay" ? (
        <RazorpayPayButton cycle={cycle} email={email} />
      ) : (
        <StripeEmbeddedCheckoutBox cycle={cycle} />
      )}
    </div>
  );
}
