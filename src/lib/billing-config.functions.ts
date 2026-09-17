import { createServerFn } from "@tanstack/react-start";

/**
 * Returns the public (publishable) RevenueCat SDK configuration.
 * This key is safe to expose to clients — it is fetched from the
 * encrypted secret store server-side and handed to the billing module.
 */
export const getBillingConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    androidPublicKey: process.env["REVENUECAT_ANDROID_PUBLIC_KEY"] || "",
  };
});
