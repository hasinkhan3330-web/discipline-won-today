import { getPaddleEnvironment } from "@/lib/paddle";

export function PaymentTestModeBanner() {
  if (getPaddleEnvironment() !== "sandbox") return null;
  return (
    <div style={{ background: "#3a2a0f", color: "#ffcf80", padding: "6px 12px", fontFamily: "monospace", fontSize: 11, letterSpacing: 2, textAlign: "center", borderBottom: "1px solid #ff9a2666" }}>
      TEST MODE — use card 4242 4242 4242 4242 to try checkout
    </div>
  );
}
