import { createFileRoute } from "@tanstack/react-router";

/** Stripe webhook — verifies the signature and keeps subscription rows in sync. */
export const Route = createFileRoute("/api/public/payments/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = url.searchParams.get("env") === "live" ? "live" : "sandbox";
        const secret =
          env === "live"
            ? process.env["PAYMENTS_LIVE_WEBHOOK_SECRET"]
            : process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"];
        if (!secret) return new Response("not configured", { status: 500 });

        const raw = await request.text();
        const signature = request.headers.get("stripe-signature") ?? "";

        const { createStripeClient } = await import("@/lib/stripe.server");
        const stripe = createStripeClient(env);

        let event;
        try {
          event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
        } catch {
          return new Response("invalid signature", { status: 401 });
        }

        const relevant = [
          "customer.subscription.created",
          "customer.subscription.updated",
          "customer.subscription.deleted",
        ];
        if (!relevant.includes(event.type)) return new Response("ok");

        const sub = event.data.object as {
          id: string;
          status: string;
          customer: string | { id: string };
          cancel_at_period_end?: boolean;
          metadata?: Record<string, string>;
          items?: { data?: { current_period_end?: number }[] };
        };
        const userId = sub.metadata?.["userId"];
        if (!userId) return new Response("ok");

        const cycle = sub.metadata?.["cycle"] === "yearly" ? "yearly" : "monthly";
        const { STRIPE_PRICE } = await import("@/lib/pricing");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const periodEnd = sub.items?.data?.[0]?.current_period_end;
        const now = new Date();

        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            provider: "stripe",
            provider_subscription_id: sub.id,
            provider_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
            price_id: STRIPE_PRICE[cycle],
            product_id: cycle,
            status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            cancel_at_period_end: sub.cancel_at_period_end ?? false,
            environment: env === "live" ? "live" : "test",
            updated_at: now.toISOString(),
          },
          { onConflict: "provider,provider_subscription_id" },
        );

        return new Response("ok");
      },
    },
  },
});
