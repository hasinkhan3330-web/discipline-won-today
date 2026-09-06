import { createFileRoute } from "@tanstack/react-router";

/**
 * RevenueCat webhook — real-time subscription state.
 *
 * RevenueCat receives Google Play Real-time Developer Notifications and Apple
 * App Store Server Notifications, then forwards normalised events here
 * (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE, ...).
 * We never trust the payload: we re-read the subscriber with the secret key
 * and mirror the verified entitlement into `subscriptions`.
 *
 * Configure in RevenueCat → Integrations → Webhooks:
 *   URL:    https://<your-domain>/api/public/payments/revenuecat-webhook
 *   Header: Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
 */
export const Route = createFileRoute("/api/public/payments/revenuecat-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["REVENUECAT_WEBHOOK_SECRET"];
        if (!secret) return new Response("not configured", { status: 500 });

        const auth = request.headers.get("authorization") ?? "";
        const provided = auth.replace(/^Bearer\s+/i, "");
        if (provided.length !== secret.length || provided !== secret) {
          return new Response("invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("bad payload", { status: 400 });
        }

        const appUserId: string | undefined =
          payload?.event?.app_user_id ?? payload?.event?.original_app_user_id;
        if (!appUserId) return new Response("ok");

        try {
          const { verifyEntitlement, priceKeyFor } = await import("@/lib/revenuecat.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const ent = await verifyEntitlement(appUserId);
          const now = new Date().toISOString();

          if (!ent.active) {
            await supabaseAdmin
              .from("subscriptions")
              .update({ status: "canceled", updated_at: now })
              .eq("user_id", appUserId)
              .eq("provider", "google_play");
            return new Response("ok");
          }

          await supabaseAdmin.from("subscriptions").upsert(
            {
              user_id: appUserId,
              provider: "google_play",
              provider_subscription_id: `rc_${ent.originalAppUserId ?? appUserId}`,
              provider_customer_id: ent.originalAppUserId ?? appUserId,
              price_id: priceKeyFor(ent.productId),
              product_id: ent.productId,
              status: ent.isTrial ? "trialing" : "active",
              current_period_end: ent.expiresAt,
              cancel_at_period_end: !ent.willRenew,
              environment: "live",
              updated_at: now,
            },
            { onConflict: "provider,provider_subscription_id" },
          );
        } catch (e) {
          console.error("revenuecat webhook sync failed", e instanceof Error ? e.message : e);
          return new Response("retry", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
