import { useEffect, useState } from "react";
import { PaymentOptions } from "@/components/PaymentOptions";
import { PlayBillingButton } from "@/components/PlayBillingButton";
import { detectPlatform, isNativeStore, type AppPlatform } from "@/lib/platform";
import type { Cycle } from "@/lib/pricing";

const G = "#00d4ff";

/**
 * Routes checkout by platform:
 *  - Android / iOS shell -> RevenueCat in-app billing only (Play & App Store policy).
 *  - Web browser -> Razorpay only (UPI, Indian cards, international cards).
 */
export function PlatformCheckout({
  userId,
  cycle,
  email,
  onSuccess,
}: {
  userId?: string | null;
  cycle: Cycle;
  email?: string | null;
  onSuccess?: () => void;
}) {
  const [platform, setPlatform] = useState<AppPlatform | null>(null);

  useEffect(() => {
    let alive = true;
    detectPlatform().then((p) => alive && setPlatform(p)).catch(() => alive && setPlatform("web"));
    return () => { alive = false; };
  }, []);

  if (!platform) {
    return (
      <div style={{ marginTop: 24, fontSize: 10, letterSpacing: 3, color: "#666", textAlign: "center" }}>
        ◌ PREPARING CHECKOUT…
      </div>
    );
  }

  if (isNativeStore(platform)) {
    const store = platform === "ios" ? "the App Store" : "Google Play";
    return (
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: "#777" }}>
          ◈ SECURE IN-APP PURCHASE · {platform === "ios" ? "APP STORE" : "GOOGLE PLAY"}
        </div>
        {userId ? (
          <PlayBillingButton
            userId={userId}
            cycle={cycle}
            label={platform === "ios" ? "SUBSCRIBE WITH APP STORE" : "SUBSCRIBE WITH GOOGLE PLAY"}
            onSuccess={onSuccess}
          />
        ) : (
          <div style={{ marginTop: 12, fontSize: 11, color: G, letterSpacing: 2 }}>SIGN IN TO CONTINUE</div>
        )}
        <p style={{ marginTop: 10, fontSize: 9, color: "#666", letterSpacing: 1, textAlign: "center" }}>
          Billed securely through {store}. Manage or cancel anytime in your {store} subscriptions.
        </p>
      </div>
    );
  }

  return <PaymentOptions cycle={cycle} email={email} onSuccess={onSuccess} />;
}
