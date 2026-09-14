import type { ReactNode } from "react";
import { PaywallGate } from "@/components/PaywallGate";
import { GateSkeleton } from "@/components/GateSkeleton";
import { useEntitlementContext } from "@/components/EntitlementProvider";

/**
 * Route/feature level gate for Zen, Rank and Coach.
 *
 * The verdict always comes from the server (get_entitlement). While it
 * resolves we show a neutral branded loader so premium content is never
 * briefly exposed. Offline or failed reads keep the last server verdict and
 * can never extend an expired trial.
 */
export function ProtectedFeatureGate({
  featureName,
  onUpgrade,
  onContinueBasic,
  children,
}: {
  featureName: string;
  onUpgrade: () => void;
  onContinueBasic?: () => void;
  children: ReactNode;
}) {
  const ent = useEntitlementContext();

  if (ent.isLoading) return <GateSkeleton />;
  if (ent.premiumAccess) return <>{children}</>;

  return (
    <PaywallGate
      hasAccess={false}
      featureName={featureName}
      trialExpired={ent.accessStatus === "expired"}
      onUpgrade={onUpgrade}
      onContinueBasic={onContinueBasic}
    >
      {children}
    </PaywallGate>
  );
}
