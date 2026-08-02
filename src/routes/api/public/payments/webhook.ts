import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createHmac, timingSafeEqual } from "crypto";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function mapStatus(status: string): string {
  switch (status) {
    case "created": return "incomplete";
    case "authenticated": return "trialing";
    case "active": return "active";
    case "pending":
    case "halted": return "past_due";
    case "paused": return "paused";
    case "cancelled":
    case "completed":
    case "expired": return "canceled";
    default: return status;
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const keyId = process.env.RAZORPAY_KEY_ID ?? "";
        const environment = keyId.startsWith("rzp_live_") ? "live" : "sandbox";

        if (!secret) {
          console.error("RAZORPAY_WEBHOOK_SECRET is not configured");
          return new Response("Webhook not configured", { status: 500 });
        }

        const rawBody = await request.text();
        const signature = request.headers.get("x-razorpay-signature");
        if (!verifySignature(rawBody, signature, secret)) {
          console.error("Razorpay webhook: invalid signature");
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const eventType: string = payload?.event ?? "unknown";
        const eventId = request.headers.get("x-razorpay-event-id") ?? `${eventType}_${payload?.created_at ?? Date.now()}`;
        const supabase = getSupabase();

        // Idempotency — Razorpay retries failed deliveries.
        const { data: seen } = await supabase
          .from("payment_events")
          .select("id")
          .eq("provider_event_id", eventId)
          .maybeSingle();
        if (seen) return new Response("ok (duplicate)");

        const sub = payload?.payload?.subscription?.entity;
        const payment = payload?.payload?.payment?.entity;
        const userId: string | null = sub?.notes?.userId ?? payment?.notes?.userId ?? null;

        try {
          if (sub?.id) {
            const periodEnd = sub.current_end ?? sub.charge_at ?? null;
            const record: Record<string, unknown> = {
              provider: "razorpay",
              provider_subscription_id: sub.id,
              provider_customer_id: sub.customer_id ?? null,
              price_id: sub.notes?.price_key ?? "dwt_pro_monthly_inr",
              product_id: sub.plan_id ?? null,
              status: mapStatus(sub.status),
              current_period_start: sub.current_start ? new Date(sub.current_start * 1000).toISOString() : null,
              current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
              cancel_at_period_end: !!sub.end_at && sub.status !== "cancelled",
              environment,
              updated_at: new Date().toISOString(),
            };

            const { error: writeError } = userId
              ? await supabase
                  .from("subscriptions")
                  .upsert({ ...record, user_id: userId } as never, {
                    onConflict: "provider,provider_subscription_id",
                  })
              : // No userId in notes (rare) — update the existing row if we already know it.
                await supabase
                  .from("subscriptions")
                  .update(record as never)
                  .eq("provider", "razorpay")
                  .eq("provider_subscription_id", sub.id);

            if (writeError) {
              // Return non-2xx so Razorpay retries the delivery.
              console.error(`Razorpay webhook: subscription write failed for ${sub.id}:`, writeError.message);
              return new Response("Subscription write failed", { status: 500 });
            }
          }


          // Explicit one-off payment events (Razorpay sends these alongside subscription events).
          if ((eventType === "payment.captured" || eventType === "payment.failed") && payment) {
            const linkedSubId: string | null = payment.subscription_id ?? sub?.id ?? null;
            if (linkedSubId) {
              const { error: payWriteError } = await supabase
                .from("subscriptions")
                .update({
                  status: eventType === "payment.captured" ? "active" : "past_due",
                  updated_at: new Date().toISOString(),
                } as never)
                .eq("provider", "razorpay")
                .eq("provider_subscription_id", linkedSubId);
              if (payWriteError) {
                console.error(`Razorpay webhook: ${eventType} write failed for ${linkedSubId}:`, payWriteError.message);
                return new Response("Payment write failed", { status: 500 });
              }
            }
          }

          // Standard Checkout (one-time order): this is where access is granted.
          if (eventType === "payment.captured" && payment?.order_id && !payment.subscription_id) {
            const buyerId: string | null = payment.notes?.userId ?? null;
            const priceKey: string = payment.notes?.price_key ?? "dwt_pro_monthly_inr";
            if (buyerId) {
              const now = new Date();
              const end = new Date(now);
              if (priceKey.includes("yearly")) end.setFullYear(end.getFullYear() + 1);
              else end.setMonth(end.getMonth() + 1);

              const { error: grantError } = await supabase.from("subscriptions").upsert(
                {
                  user_id: buyerId,
                  provider: "razorpay",
                  provider_subscription_id: payment.order_id,
                  provider_customer_id: payment.customer_id ?? null,
                  price_id: priceKey,
                  product_id: null,
                  status: "active",
                  current_period_start: now.toISOString(),
                  current_period_end: end.toISOString(),
                  cancel_at_period_end: true,
                  environment,
                  updated_at: now.toISOString(),
                } as never,
                { onConflict: "provider,provider_subscription_id" },
              );
              if (grantError) {
                console.error(`Razorpay webhook: access grant failed for ${payment.order_id}:`, grantError.message);
                return new Response("Grant write failed", { status: 500 });
              }
            } else {
              console.error(`Razorpay webhook: payment.captured ${payment.id} has no userId note — cannot grant access`);
            }
          }


          await supabase.from("payment_events").insert({
            provider_event_id: eventId,
            event_type: eventType,
            environment,
            user_id: userId,
            subscription_id: sub?.id ?? null,
            transaction_id: payment?.id ?? null,
            amount: payment?.amount != null ? Math.round(payment.amount) / 100 : null,
            currency: payment?.currency ?? null,
            status: payment?.status ?? sub?.status ?? null,
          } as never);
        } catch (err) {
          console.error("Razorpay webhook processing failed:", err);
          return new Response("Processing error", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
