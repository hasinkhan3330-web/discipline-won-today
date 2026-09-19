/**
 * AXEN PRO catalog.
 *
 * Billing is handled EXCLUSIVELY by the app stores:
 * Google Play Billing (Android) and Apple StoreKit 2 (iOS), through RevenueCat.
 * There is no web/third-party gateway in this build.
 */

export type Cycle = "monthly" | "yearly";

export const PRICING: Record<Cycle, { priceKey: string; display: string; sub: string; save?: string }> = {
  monthly: {
    priceKey: "dwt_pro_monthly_play",
    display: "₹99/month",
    sub: "Monthly AXEN Pro access",
  },
  yearly: {
    priceKey: "dwt_pro_yearly_play",
    display: "₹499/year",
    sub: "Best Value",
    save: "Save 58%",
  },
};

export function planLabelFor(priceId?: string | null): string {
  if (!priceId) return "AXEN PRO";
  return priceId.includes("yearly") ? "AXEN PRO · YEARLY" : "AXEN PRO · MONTHLY";
}
