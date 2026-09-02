import { useEffect, useState } from "react";
import { RazorpayPayButton } from "@/components/RazorpayPayButton";
import { PayPalPayButton } from "@/components/PayPalPayButton";
import { getWebPaymentMethods } from "@/lib/paypal.functions";
import { PRICING, INTL_DISPLAY, USD_DISPLAY, type Cycle } from "@/lib/pricing";

const G = "#00d4ff";
const G2 = "#a855f7";

type Method = "upi" | "cards" | "paypal";

/**
 * Web-only checkout modal (desktop + mobile browser).
 * Never rendered inside the Android / iOS shells — store billing is used there
 * (Google Play & App Store policy).
 */
export function PaymentOptions({ cycle, email }: { cycle: Cycle; email?: string | null }) {
  const [method, setMethod] = useState<Method>("upi");
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getWebPaymentMethods()
      .then((m) => alive && setPaypalClientId(m.paypal ? m.paypalClientId : null))
      .catch(() => alive && setPaypalClientId(null));
    return () => {
      alive = false;
    };
  }, []);

  const options: { id: Method; title: string; sub: string; price: string }[] = [
    {
      id: "upi",
      title: "UPI · INDIA",
      sub: "GPay · PhonePe · Paytm · any UPI app",
      price: PRICING[cycle].display,
    },
    {
      id: "cards",
      title: "CARDS / NETBANKING",
      sub: "Visa · Mastercard · Amex · RuPay — worldwide",
      price: INTL_DISPLAY[cycle],
    },
    ...(paypalClientId
      ? [
          {
            id: "paypal" as const,
            title: "PAYPAL · INTERNATIONAL",
            sub: "Pay in USD with your PayPal balance or card",
            price: USD_DISPLAY[cycle],
          },
        ]
      : []),
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

      {method === "paypal" && paypalClientId ? (
        <PayPalPayButton clientId={paypalClientId} cycle={cycle} />
      ) : (
        <RazorpayPayButton cycle={cycle} email={email} method={method === "upi" ? "upi" : "card"} />
      )}

      {method === "cards" && (
        <p style={{ marginTop: 8, fontSize: 9, color: "#666", letterSpacing: 1, textAlign: "center" }}>
          International cards are accepted. The charge is made in INR ({PRICING[cycle].display}); your bank
          converts it to your local currency at its own rate.
        </p>
      )}
    </div>
  );
}
