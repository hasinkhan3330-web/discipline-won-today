import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

let _supabase: any = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

// Look up the user attached to a subscription that already lives in our DB.
// Used by transaction events that don't carry customData.userId directly.
async function findUserBySubscription(paddleSubId: string | null | undefined) {
  if (!paddleSubId) return null;
  const { data } = await getSupabase()
    .from("subscriptions")
    .select("user_id")
    .eq("paddle_subscription_id", paddleSubId)
    .maybeSingle();
  return (data?.user_id as string) ?? null;
}

async function upsertSubscription(data: any, env: PaddleEnv, opts: { requireCustomData?: boolean } = {}) {
  const { id, customerId, items, status, currentBillingPeriod, customData, scheduledChange } = data;

  // On UPDATE/CANCEL, customData may be missing — resolve user_id from DB.
  let userId = customData?.userId as string | undefined;
  if (!userId) userId = (await findUserBySubscription(id)) ?? undefined;
  if (!userId) {
    if (opts.requireCustomData) console.error("subscription.created missing customData.userId");
    else console.warn("subscription event with no matching user_id; ignoring", { id });
    return;
  }

  const item = items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn("Skipping subscription upsert: missing importMeta.externalId", { id });
    return;
  }

  await getSupabase().from("subscriptions").upsert({
    user_id: userId,
    paddle_subscription_id: id,
    paddle_customer_id: customerId,
    product_id: productId,
    price_id: priceId,
    status,
    current_period_start: currentBillingPeriod?.startsAt,
    current_period_end: currentBillingPeriod?.endsAt,
    cancel_at_period_end: scheduledChange?.action === "cancel",
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: "paddle_subscription_id" });
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await getSupabase().from("subscriptions").update({
    status: "canceled",
    updated_at: new Date().toISOString(),
  }).eq("paddle_subscription_id", data.id).eq("environment", env);
}

// Idempotent audit-log write. UNIQUE(paddle_event_id) prevents duplicates
// if Paddle retries the webhook.
async function recordEvent(event: any, env: PaddleEnv) {
  const d = event.data ?? {};
  const subscriptionId = d.subscriptionId || d.id || null;
  const transactionId = d.id && event.eventType.startsWith("transaction.") ? d.id : (d.transactionId || null);
  const userId =
    d.customData?.userId ??
    (await findUserBySubscription(subscriptionId));

  await getSupabase().from("payment_events").upsert({
    paddle_event_id: event.eventId,
    user_id: userId,
    event_type: event.eventType,
    subscription_id: subscriptionId,
    transaction_id: transactionId,
    amount: d.details?.totals?.grandTotal
      ? Number(d.details.totals.grandTotal)
      : (d.totals?.grandTotal ? Number(d.totals.grandTotal) : null),
    currency: d.currencyCode ?? d.details?.totals?.currencyCode ?? null,
    status: d.status ?? null,
    environment: env,
    raw: d,
  }, { onConflict: "paddle_event_id" });
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await upsertSubscription(event.data, env, { requireCustomData: true });
      break;
    case EventName.SubscriptionUpdated:
      // Upsert (not update) so an out-of-order 'updated' before 'created'
      // still persists — Paddle sometimes sends them close together.
      await upsertSubscription(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    default:
      // transaction.completed / transaction.payment_failed and anything else
      // — audit-only. No subscription-state mutation needed.
      break;
  }

  // Always audit-log the event (idempotent via paddle_event_id UNIQUE).
  try {
    await recordEvent(event, env);
  } catch (e) {
    console.error("payment_events insert failed:", e);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
