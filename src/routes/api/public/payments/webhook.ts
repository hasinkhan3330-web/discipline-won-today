import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

function priceIdOf(item: any): string | undefined {
  return item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id;
}

async function logEvent(params: {
  eventId: string;
  eventType: string;
  env: StripeEnv;
  userId?: string | null;
  subscriptionId?: string | null;
  transactionId?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
}) {
  await getSupabase().from("payment_events").insert({
    provider_event_id: params.eventId,
    event_type: params.eventType,
    environment: params.env,
    user_id: params.userId ?? null,
    subscription_id: params.subscriptionId ?? null,
    transaction_id: params.transactionId ?? null,
    amount: params.amount ?? null,
    currency: params.currency ?? null,
    status: params.status ?? null,
  });
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return null;
  }

  const item = subscription.items?.data?.[0];
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
      product_id: String(item?.price?.product ?? ""),
      price_id: priceIdOf(item) ?? "",
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  return userId as string;
}

async function userIdForSubscription(subscriptionId: string, env: StripeEnv) {
  const { data } = await getSupabase()
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .eq("environment", env)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = (await verifyWebhook(req, env)) as any;
  const object = event.data.object;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const userId = await upsertSubscription(object, env);
      await logEvent({
        eventId: event.id,
        eventType: event.type,
        env,
        userId,
        subscriptionId: object.id,
        status: object.status,
      });
      break;
    }
    case "customer.subscription.deleted": {
      await getSupabase()
        .from("subscriptions")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", object.id)
        .eq("environment", env);
      await logEvent({
        eventId: event.id,
        eventType: event.type,
        env,
        userId: await userIdForSubscription(object.id, env),
        subscriptionId: object.id,
        status: "canceled",
      });
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const subscriptionId = object.subscription ?? object.parent?.subscription_details?.subscription ?? null;
      await logEvent({
        eventId: event.id,
        eventType: event.type,
        env,
        userId: subscriptionId ? await userIdForSubscription(subscriptionId, env) : null,
        subscriptionId,
        transactionId: object.id,
        amount: typeof object.amount_paid === "number" ? object.amount_paid / 100 : null,
        currency: object.currency ?? null,
        status: event.type === "invoice.paid" ? "paid" : "failed",
      });
      break;
    }
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed": {
      await logEvent({
        eventId: event.id,
        eventType: event.type,
        env,
        userId: object.metadata?.userId ?? null,
        transactionId: object.id,
        amount: typeof object.amount_total === "number" ? object.amount_total / 100 : null,
        currency: object.currency ?? null,
        status: object.payment_status ?? null,
      });
      break;
    }
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid or missing env query parameter:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
