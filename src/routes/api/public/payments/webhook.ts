import { createFileRoute } from "@tanstack/react-router";

/** Razorpay webhook — re-confirms payments server-side. */
async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        if (!secret) return new Response("not configured", { status: 500 });

        const raw = await request.text();
        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const expected = await hmacHex(secret, raw);
        if (!signature || !safeEqual(signature, expected)) {
          return new Response("invalid signature", { status: 401 });
        }

        let event: any;
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("bad payload", { status: 400 });
        }

        const payment = event?.payload?.payment?.entity;
        const notes = payment?.notes ?? {};
        const userId: string | undefined = notes.user_id;
        const cycle: "monthly" | "yearly" = notes.cycle === "yearly" ? "yearly" : "monthly";
        const type: string = event?.event ?? "";

        if (type === "payment.captured" && userId && payment?.order_id) {
          const { PRICING } = await import("@/lib/pricing");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const now = new Date();
          const end = new Date(now);
          if (cycle === "yearly") end.setFullYear(end.getFullYear() + 1);
          else end.setMonth(end.getMonth() + 1);

          await supabaseAdmin.from("subscriptions").upsert(
            {
              user_id: userId,
              provider: "razorpay",
              provider_subscription_id: payment.order_id,
              provider_customer_id: userId,
              price_id: PRICING[cycle].priceKey,
              product_id: cycle,
              status: "active",
              current_period_start: now.toISOString(),
              current_period_end: end.toISOString(),
              cancel_at_period_end: true,
              environment: "live",
              updated_at: now.toISOString(),
            },
            { onConflict: "provider,provider_subscription_id" },
          );
        }

        // Lifecycle: failures, cancellations, pauses and expiries flow back into
        // the same row so entitlement re-locks without any client involvement.
        const LIFECYCLE: Record<string, string> = {
          "payment.failed": "past_due",
          "subscription.pending": "past_due",
          "subscription.halted": "past_due",
          "subscription.paused": "paused",
          "subscription.resumed": "active",
          "subscription.activated": "active",
          "subscription.charged": "active",
          "subscription.cancelled": "canceled",
          "subscription.completed": "expired",
          "subscription.expired": "expired",
        };

        const mapped = LIFECYCLE[type];
        if (mapped) {
          const sub = event?.payload?.subscription?.entity;
          const providerId: string | undefined = sub?.id ?? payment?.order_id;
          if (providerId) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const patch: { status: string; updated_at: string; current_period_end?: string } = { status: mapped, updated_at: new Date().toISOString() };
            if (sub?.current_end) patch["current_period_end"] = new Date(sub.current_end * 1000).toISOString();
            if (mapped === "expired") patch["current_period_end"] = new Date().toISOString();
            await supabaseAdmin
              .from("subscriptions")
              .update(patch)
              .eq("provider", "razorpay")
              .eq("provider_subscription_id", providerId);
          }
        }

        return new Response("ok");

      },
    },
  },
});
