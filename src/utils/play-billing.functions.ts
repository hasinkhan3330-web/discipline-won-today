import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SyncResult =
  | { active: boolean; expiresAt: string | null; priceKey: string | null }
  | { error: string };

/**
 * Re-reads the caller's RevenueCat subscriber record with the server secret
 * key and mirrors the Google Play entitlement into `subscriptions`.
 * Used after a purchase and after "Restore Purchase".
 */
export const syncPlayEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncResult> => {
    try {
      const { verifyEntitlement, priceKeyFor } = await import("@/lib/revenuecat.server");
      const ent = await verifyEntitlement(context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const priceKey = ent.active ? priceKeyFor(ent.productId) : null;

      if (!ent.active) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("user_id", context.userId)
          .eq("provider", "google_play");
        return { active: false, expiresAt: ent.expiresAt, priceKey: null };
      }

      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: context.userId,
          provider: "google_play",
          provider_subscription_id: `rc_${ent.originalAppUserId ?? context.userId}`,
          provider_customer_id: ent.originalAppUserId ?? context.userId,
          price_id: priceKeyFor(ent.productId),
          product_id: ent.productId,
          status: "active",
          current_period_start: null,
          current_period_end: ent.expiresAt,
          cancel_at_period_end: !ent.willRenew,
          short_url: null,
          environment: "live",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider,provider_subscription_id" },
      );

      return { active: true, expiresAt: ent.expiresAt, priceKey };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not verify your Play purchase." };
    }
  });
