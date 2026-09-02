import { useEffect, useState } from "react";
import { RazorpayPayButton } from "@/components/RazorpayPayButton";
import { PayPalPayButton } from "@/components/PayPalPayButton";
import { getWebPaymentMethods } from "@/lib/paypal.functions";
import { PRICING, INTL_DISPLAY, USD_DISPLAY, type Cycle } from "@/lib/pricing";

const G = "#00d4ff";
const G2 = "#a855f7";

type Method = "upi" | "cards" | "paypal";

type Methods = { razorpay: boolean; paypal: boolean; paypalClientId: string | null };

/**
 * Web-only checkout modal (desktop + mobile browser).
 * Never rendered inside the Android / iOS shells — store billing is used there
 * (Google Play & App Store policy).
 *
 * Credential fallback: if the Cloud secrets for Razorpay / PayPal are missing
 * or temporarily unreadable, the modal shows a calm "Payment system loading…"
 * message instead of rendering a checkout button that would crash on tap.
 */
export function PaymentOptions({
  cycle,
  email,
  onSuccess,
}: {
  cycle: Cycle;
  email?: string | null;
  onSuccess?: () => void;
}) {
  const [method, setMethod] = useState<Method>("upi");
  const [methods, setMethods] = useState<Methods | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    getWebPaymentMethods()
      .then((m) => {
        if (!alive) return;
        setMethods({
          razorpay: !!m.razorpay,
          paypal: !!m.paypal,
          paypalClientId: m.paypal ? m.paypalClientId : null,
        });
      })
      .catch(() => {
        if (!alive) return;
        setMethods(null);
        setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const notice = (text: string) => (
    <div
      style={{
        marginTop: 24,
        padding: 16,
        border: "1px solid #333",
        borderRadius: 4,
        background: "rgba(10,10,25,0.7)",
        color: G,
        fontFamily: "monospace",
        fontSize: 11,
        letterSpacing: 2,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );

  if (!methods && !failed) return notice("◌ PREPARING PAYMENT METHODS…");

  const razorpayOn = !!methods?.razorpay;
  const paypalClientId = methods?.paypalClientId ?? null;

  // No provider credentials available right now — never crash, just reassure.
  if (!razorpayOn && !paypalClientId) {
    return notice("Payment system loading… Please try again shortly.");
  }

  const options: { id: Method; title: string; sub: string; price: string }[] = [
    ...(razorpayOn
      ? [
          {
            id: "upi" as const,
            title: "UPI · INDIA",
            sub: "GPay · PhonePe · Paytm · any UPI app",
            price: PRICING[cycle].display,
          },
          {
            id: "cards" as const,
            title: "CARDS / NETBANKING",
            sub: "Visa · Mastercard · Amex · RuPay — worldwide",
            price: INTL_DISPLAY[cycle],
          },
        ]
      : []),
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

  const active = options.some((o) => o.id === method) ? method : options[0]!.id;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 10, letterSpacing: 3, color: "#777" }}>◈ CHOOSE PAYMENT METHOD</div>

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map((o) => {
          const on = active === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setMethod(o.id)}
              style={{
                textAlign: "left", padding: 14, cursor: "pointer",
                background: on ? `linear-gradient(135deg, ${G}1c, ${G2}1c)` : "rgba(10,10,25,0.7)",
                border: `1px solid ${on ? G : "#333"}`,
                borderRadius: 4, color: "#fff", fontFamily: "monospace",
                boxShadow: on ? `0 0 16px ${G}44` : "none",
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

      {active === "paypal" && paypalClientId ? (
        <PayPalPayButton clientId={paypalClientId} cycle={cycle} onSuccess={onSuccess} />
      ) : (
        <RazorpayPayButton
          cycle={cycle}
          email={email}
          method={active === "upi" ? "upi" : "card"}
          onSuccess={onSuccess}
        />
      )}

      {active === "cards" && (
        <p style={{ marginTop: 8, fontSize: 9, color: "#666", letterSpacing: 1, textAlign: "center" }}>
          International cards are accepted. The charge is made in INR ({PRICING[cycle].display}); your bank
          converts it to your local currency at its own rate.
        </p>
      )}
    </div>
  );
}
