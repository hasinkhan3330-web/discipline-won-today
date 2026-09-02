import { createFileRoute } from "@tanstack/react-router";

/**
 * PayPal webhook — re-confirms captures server-side.
 * The payload is verified with PayPal's verify-webhook-signature API before
 * any entitlement is written.
 */

function apiBase(): string {
  return process.env["PAYPAL_ENV"] === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function accessToken(): Promise<string | null> {
  const id = process.env["PAYPAL_CLIENT_ID"];
  const secret = process.env["PAYPAL_CLIENT_SECRET"];
  if (!id || !secret) return null;
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  return ((await res.json()) as { access_token?: string }).access_token ?? null;
}

export const Route = createFileRoute("/api/public/payments/paypal-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookId = process.env["PAYPAL_WEBHOOK_ID"];
        if (!webhookId) return new Response("not configured", { status: 500 });

        const raw = await request.text();
        const token = await accessToken();
        if (!token) return new Response("not configured", { status: 500 });

        const verifyRes = await fetch(`${apiBase()}/v1/notifications/verify-webhook-signature`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            auth_algo: request.headers.get("paypal-auth-algo"),
            cert_url: request.headers.get("paypal-cert-url"),
            transmission_id: request.headers.get("paypal-transmission-id"),
            transmission_sig: request.headers.get("paypal-transmission-sig"),
            transmission_time: request.headers.get("paypal-transmission-time"),
            webhook_id: webhookId,
            webhook_event: JSON.parse(raw),
          }),
        });
        const verdict = (await verifyRes.json().catch(() => null)) as { verification_status?: string } | null;
        if (!verifyRes.ok || verdict?.verification_status !== "SUCCESS") {
          return new Response("invalid signature", { status: 401 });
        }

        const event = JSON.parse(raw) as any;
        if (event?.event_type !== "PAYMENT.CAPTURE.COMPLETED") return new Response("ignored");

        const resource = event?.resource ?? {};
        const [userId, cycleRaw] = String(resource?.custom_id ?? "").split("|");
        if (!userId) return new Response("ignored");
        const cycle: "monthly" | "yearly" = cycleRaw === "yearly" ? "yearly" : "monthly";

        const orderId: string =
          resource?.supplementary_data?.related_ids?.order_id ?? resource?.id ?? "";
        if (!orderId) return new Response("ignored");

        const { PRICING } = await import("@/lib/pricing");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();
        const end = new Date(now);
        if (cycle === "yearly") end.setFullYear(end.getFullYear() + 1);
        else end.setMonth(end.getMonth() + 1);

        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            provider: "paypal",
            provider_subscription_id: orderId,
            provider_customer_id: userId,
            price_id: PRICING[cycle].priceKey,
            product_id: cycle,
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: end.toISOString(),
            cancel_at_period_end: true,
            environment: process.env["PAYPAL_ENV"] === "live" ? "live" : "sandbox",
            updated_at: now.toISOString(),
          },
          { onConflict: "provider,provider_subscription_id" },
        );

        return new Response("ok");
      },
    },
  },
});
