import { useState } from "react";
import { RazorpayPayButton } from "@/components/RazorpayPayButton";
import { PRICING, INTL_DISPLAY, type Cycle } from "@/lib/pricing";

const G = "#00d4ff";
const G2 = "#a855f7";

type Method = "upi" | "international";

/**
 * Web-only checkout (desktop + mobile browser).
 * Razorpay handles both Indian methods (UPI / netbanking / RuPay) and
 * international Visa / Mastercard / Amex cards.
 */
export function PaymentOptions({ cycle, email }: { cycle: Cycle; email?: string | null }) {
  const [method, setMethod] = useState<Method>("upi");

  const options: { id: Method; title: string; sub: string; price: string }[] = [
    {
      id: "upi",
      title: "INDIA · UPI / CARDS",
      sub: "UPI · RuPay · Debit / Credit · Netbanking",
      price: PRICING[cycle].display,
    },
    {
      id: "international",
      title: "INTERNATIONAL CARDS",
      sub: "Visa · Mastercard · Amex — worldwide",
      price: INTL_DISPLAY[cycle],

    },
  ];

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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ letterSpacing: 3, fontWeight: 900, fontSize: 12 }}>{o.title}</div>
                <div style={{ fontSize: 11, color: G, fontWeight: 900 }}>{o.price}</div>
              </div>
              <div style={{ marginTop: 5, fontSize: 10, color: "#888", letterSpacing: 1 }}>{o.sub}</div>
            </button>
          );
        })}
      </div>

      <RazorpayPayButton cycle={cycle} email={email} />

      {method === "international" && (
        <p style={{ marginTop: 8, fontSize: 9, color: "#666", letterSpacing: 1, textAlign: "center" }}>
          International cards are accepted. The charge is made in INR ({PRICING[cycle].display}); your bank
          converts it to your local currency at its own rate.
        </p>
      )}
    </div>
  );
}
