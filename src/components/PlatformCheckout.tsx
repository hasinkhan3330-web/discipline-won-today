import { PlayBillingButton } from "@/components/PlayBillingButton";
import { usePlatform } from "@/hooks/usePlatform";
import { type Cycle } from "@/lib/pricing";

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
    return <div className="ax-checkout-state">PREPARING…</div>;
  }

  if (!isNative) {
    return <div className="ax-checkout-state">OPEN AXEN ON YOUR PHONE TO UNLOCK PRO</div>;
  }

  return (
    <div className="ax-checkout">
      {userId ? (
        <PlayBillingButton
          userId={userId}
          cycle={cycle}
          label="UNLOCK AXEN PRO"
          onSuccess={onSuccess}
        />
      ) : (
        <div className="ax-checkout-state">SIGN IN TO CONTINUE</div>
      )}
    </div>
  );
}
