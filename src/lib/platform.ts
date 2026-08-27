/**
 * Runtime platform detection used to route payments.
 *
 * Store policy:
 *  - android / ios (native shell) -> RevenueCat in-app billing ONLY.
 *  - web (desktop or mobile browser) -> Razorpay ONLY (no third-party SDK in native).
 */

export type AppPlatform = "web" | "android" | "ios";

/** Detects the active platform. Always "web" during SSR. */
export async function detectPlatform(): Promise<AppPlatform> {
  if (typeof window === "undefined") return "web";
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return "web";
    const p = Capacitor.getPlatform();
    return p === "ios" ? "ios" : "android";
  } catch {
    return "web";
  }
}

/** True when third-party web payment methods must be hidden (Play / App Store policy). */
export function isNativeStore(platform: AppPlatform): boolean {
  return platform === "android" || platform === "ios";
}
