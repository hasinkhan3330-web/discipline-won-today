import { useEffect, useState } from "react";
import { getPaymentConfig } from "@/utils/payments.functions";

/** Shows an amber strip while the app is running against Razorpay test keys. */
export function PaymentTestModeBanner() {
  const [env, setEnv] = useState<"sandbox" | "live" | "unknown">("unknown");

  useEffect(() => {
    let cancelled = false;
    getPaymentConfig()
      .then(c => { if (!cancelled) setEnv(c.environment); })
      .catch(() => { if (!cancelled) setEnv("unknown"); });
    return () => { cancelled = true; };
  }, []);

  if (env !== "sandbox") return null;

  return (
    <div style={{ background: "#3a2a0f", color: "#ffcf80", padding: "6px 12px", fontFamily: "monospace", fontSize: 11, letterSpacing: 2, textAlign: "center", borderBottom: "1px solid #ff9a2666" }}>
      TEST MODE — Razorpay test keys · use card 4111 1111 1111 1111 or UPI success@razorpay
    </div>
  );
}
