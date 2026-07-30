const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div style={{ background: "#3a0f0f", color: "#ff9a9a", padding: "6px 12px", fontFamily: "monospace", fontSize: 11, letterSpacing: 2, textAlign: "center", borderBottom: "1px solid #ff4d4d55" }}>
        CHECKOUT NOT CONFIGURED — complete payment go-live to accept real payments
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div style={{ background: "#3a2a0f", color: "#ffcf80", padding: "6px 12px", fontFamily: "monospace", fontSize: 11, letterSpacing: 2, textAlign: "center", borderBottom: "1px solid #ff9a2666" }}>
        TEST MODE — use card 4242 4242 4242 4242 to try checkout
      </div>
    );
  }
  return null;
}
