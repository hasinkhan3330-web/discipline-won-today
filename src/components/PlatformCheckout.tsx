import { PlayBillingButton } from "@/components/PlayBillingButton";
import { usePlatform } from "@/hooks/usePlatform";
import { PRICING, type Cycle } from "@/lib/pricing";

const G = "#00d4ff";

/**
 * Store-only checkout.
 *
 * Android  -> Google Play Billing (RevenueCat)
 * iOS      -> Apple StoreKit 2 In-App Purchase (RevenueCat)
 * Browser  -> no checkout at all. There is deliberately no web payment path,
 *             no external link and no third-party gateway in this build.
 */
export function PlatformCheckout({
  userId,
  cycle,
  onSuccess,
}: {
  userId?: string | null;
  cycle: Cycle;
  /** Kept for call-site compatibility; store billing uses the store account. */
  email?: string | null;
  onSuccess?: () => void;
}) {
  const { platform, isNative } = usePlatform();

  if (!platform) {
    return (
      <div style={{ marginTop: 24, fontSize: 10, letterSpacing: 3, color: "#666", textAlign: "center" }}>
        ◌ PREPARING CHECKOUT…
      </div>
    );
  }

  if (!isNative) {
    return (
      <div
        style={{
          marginTop: 24, padding: 16, border: "1px solid #23232E", borderRadius: 6,
          background: "rgba(10,10,25,0.7)", color: "#9fb3c4", fontFamily: "monospace",
          fontSize: 11, letterSpacing: 1, lineHeight: 1.8, textAlign: "center",
        }}
      >
        <div style={{ color: G, letterSpacing: 3, fontSize: 10, fontWeight: 900 }}>◈ SUBSCRIBE IN THE AXEN APP</div>
        AXEN PRO is purchased inside the AXEN mobile app through Google Play Billing or the Apple App Store,
        with a 3-day free trial. Open AXEN on your phone to start.
      </div>
    );
  }

  const apple = platform === "ios";
  const store = apple ? "the App Store" : "Google Play";

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 10, letterSpacing: 3, color: "#777" }}>
        ◈ SECURE IN-APP PURCHASE · {apple ? "APP STORE" : "GOOGLE PLAY"}
      </div>
      {userId ? (
        <PlayBillingButton
          userId={userId}
          cycle={cycle}
          label={`PAY ${PRICING[cycle].display.toUpperCase()}`}
          onSuccess={onSuccess}
        />
      ) : (
        <div style={{ marginTop: 12, fontSize: 11, color: G, letterSpacing: 2 }}>SIGN IN TO CONTINUE</div>
      )}
      <p style={{ marginTop: 10, fontSize: 9, color: "#666", letterSpacing: 1, textAlign: "center", lineHeight: 1.7 }}>
        3 days free, then {PRICING[cycle].display} billed by {store}. A payment method on your{" "}
        {apple ? "Apple ID" : "Google account"} is required to start the trial; you are not charged during the
        3 days and it converts automatically unless cancelled. Manage or cancel anytime in {store} → Subscriptions.
      </p>
    </div>
  );
}
