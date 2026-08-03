/**
 * Google Play Billing via the RevenueCat Capacitor plugin.
 *
 * Everything here is browser-safe: the native plugin is imported dynamically
 * and only when the app actually runs inside the Capacitor Android shell.
 * On the web the helpers report "not available" and the existing Razorpay
 * checkout keeps working unchanged.
 */

import type { Cycle } from "@/lib/pricing";

/** RevenueCat entitlement identifier configured in the RevenueCat dashboard. */
export const ENTITLEMENT_ID = "pro";

/** Package identifiers inside the RevenueCat "default" offering. */
export const PACKAGE_ID: Record<Cycle, string[]> = {
  monthly: ["$rc_monthly", "monthly"],
  yearly: ["$rc_annual", "annual", "yearly"],
};

const ANDROID_API_KEY = import.meta.env['VITE_REVENUECAT_ANDROID_API_KEY'] as string | undefined;

let initialised: string | null = null;

/** True only inside the native Android/iOS Capacitor shell. */
export async function isNativeBillingAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() && !!ANDROID_API_KEY;
  } catch {
    return false;
  }
}

async function plugin() {
  const mod = await import("@revenuecat/purchases-capacitor");
  return mod;
}

/** Configure RevenueCat once, identified by the signed-in Supabase user id. */
export async function initPlayBilling(appUserId: string): Promise<void> {
  if (!(await isNativeBillingAvailable())) throw new Error("Google Play billing is only available in the Android app.");
  const { Purchases, LOG_LEVEL } = await plugin();
  if (initialised === appUserId) return;
  if (initialised) {
    await Purchases.logIn({ appUserID: appUserId });
  } else {
    await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
    await Purchases.configure({ apiKey: ANDROID_API_KEY!, appUserID: appUserId });
  }
  initialised = appUserId;
}

function hasEntitlement(info: any): boolean {
  return !!info?.entitlements?.active?.[ENTITLEMENT_ID];
}

/** Opens the official Google Play purchase sheet for the chosen cycle. */
export async function purchaseCycle(appUserId: string, cycle: Cycle): Promise<{ active: boolean }> {
  await initPlayBilling(appUserId);
  const { Purchases } = await plugin();

  const offerings = await Purchases.getOfferings();
  const offering = offerings.current ?? Object.values(offerings.all ?? {})[0];
  if (!offering) throw new Error("No Play products available. Check your RevenueCat offering.");

  const wanted = PACKAGE_ID[cycle];
  const pkg =
    offering.availablePackages.find(p => wanted.includes(p.identifier)) ??
    offering.availablePackages.find(p =>
      cycle === "yearly"
        ? /year|annual/i.test(p.product.identifier)
        : /month/i.test(p.product.identifier),
    );
  if (!pkg) throw new Error(`No ${cycle} product found in the RevenueCat offering.`);

  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  return { active: hasEntitlement(customerInfo) };
}

/** Restores any Play purchase already attached to the device's Google account. */
export async function restorePlayPurchases(appUserId: string): Promise<{ active: boolean }> {
  await initPlayBilling(appUserId);
  const { Purchases } = await plugin();
  const { customerInfo } = await Purchases.restorePurchases();
  return { active: hasEntitlement(customerInfo) };
}

/** True when the user is already cancelling/purchase-cancelled the Play sheet. */
export function isUserCancelled(error: unknown): boolean {
  const e = error as { code?: string | number; message?: string } | undefined;
  return e?.code === "1" || e?.code === 1 || /cancel/i.test(e?.message ?? "");
}
