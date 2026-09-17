/**
 * Google Play Billing via the RevenueCat Capacitor plugin.
 *
 * This is the ONLY payment path in the app. Everything here is browser-safe:
 * the native plugin is imported dynamically and only when the app actually
 * runs inside the Capacitor Android shell.
 */

import type { Cycle } from "@/lib/pricing";

/* ------------------------------------------------------------------ */
/*  ▼▼▼  FILL THESE TWO THINGS IN  ▼▼▼                                 */
/* ------------------------------------------------------------------ */

/** 1. RevenueCat Android PUBLIC SDK key (starts with `goog_...`).
 *     RevenueCat dashboard → Project → API keys → Android (public).
 *     Either paste it here, or set VITE_REVENUECAT_ANDROID_API_KEY. */
export const REVENUECAT_ANDROID_PUBLIC_KEY = "";

/** 2. Play Console subscription product IDs (Monetize → Subscriptions).
 *     These must match the products attached to your RevenueCat offering. */
export const PLAY_PRODUCT_ID: Record<Cycle, string> = {
  monthly: "dwt_premium_monthly",
  yearly: "dwt_premium_yearly",
};

/* ------------------------------------------------------------------ */

/** RevenueCat entitlement identifier configured in the RevenueCat dashboard. */
export const ENTITLEMENT_ID = "premium";

/** Package identifiers inside the RevenueCat "default" offering. */
export const PACKAGE_ID: Record<Cycle, string[]> = {
  monthly: ["$rc_monthly", "monthly"],
  yearly: ["$rc_annual", "annual", "yearly"],
};

let cachedAndroidKey: string | null = null;

/** Fetches the public SDK key from the server's encrypted store (cached). */
async function fetchAndroidPublicKey(): Promise<string | undefined> {
  if (cachedAndroidKey !== null) return cachedAndroidKey || undefined;
  try {
    const { getBillingConfig } = await import("@/lib/billing-config.functions");
    const cfg = await getBillingConfig();
    cachedAndroidKey = cfg.androidPublicKey || "";
    return cachedAndroidKey || undefined;
  } catch {
    return undefined;
  }
}

async function storeApiKey(): Promise<string | undefined> {
  const envAndroid = import.meta.env['VITE_REVENUECAT_ANDROID_API_KEY'] as string | undefined;
  const envIos = import.meta.env['VITE_REVENUECAT_IOS_API_KEY'] as string | undefined;
  const fallbackAndroid = REVENUECAT_ANDROID_PUBLIC_KEY || undefined;

  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.getPlatform() === "ios") {
      return envIos || envAndroid || fallbackAndroid || (await fetchAndroidPublicKey());
    }
    return envAndroid || fallbackAndroid || (await fetchAndroidPublicKey());
  } catch {
    return envAndroid || fallbackAndroid || (await fetchAndroidPublicKey());
  }
}

let initialised: string | null = null;

/** True only inside the native Android/iOS Capacitor shell. */
export async function isNativeBillingAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() && !!(await storeApiKey());
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
  const apiKey = await storeApiKey();
  if (!apiKey) throw new Error("Store billing is not configured yet (missing RevenueCat public SDK key).");
  if (!(await isNativeBillingAvailable())) throw new Error("In-app billing is only available inside the mobile app.");
  const { Purchases, LOG_LEVEL } = await plugin();
  if (initialised === appUserId) return;
  if (initialised) {
    await Purchases.logIn({ appUserID: appUserId });
  } else {
    await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
    await Purchases.configure({ apiKey, appUserID: appUserId });
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
  const productId = PLAY_PRODUCT_ID[cycle];
  const pkg =
    offering.availablePackages.find(p => p.product.identifier.startsWith(productId)) ??
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

/** True when the user cancelled/dismissed the Play purchase sheet. */
export function isUserCancelled(error: unknown): boolean {
  const e = error as { code?: string | number; message?: string } | undefined;
  return e?.code === "1" || e?.code === 1 || /cancel/i.test(e?.message ?? "");
}

/** Deep link to the Play Store subscription management screen. */
export function playManageUrl(productId?: string | null): string {
  const pkg = "com.hasin.axen";
  return productId
    ? `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(productId)}&package=${pkg}`
    : `https://play.google.com/store/account/subscriptions?package=${pkg}`;
}
