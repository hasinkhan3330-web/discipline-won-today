import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PaymentConfig = { keyId: string; environment: "sandbox" | "live"; trialDays: number };

type CreateResult =
  | { subscriptionId: string; keyId: string; environment: "sandbox" | "live"; shortUrl: string | null }
  | { error: string };

type OkResult = { ok: true } | { error: string };

/** Public-ish: the Razorpay key id is a publishable value, but we still gate it behind auth. */
export const getPaymentConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<PaymentConfig> => {
    const { getKeyId, getPaymentEnv, TRIAL_DAYS } = await import("@/lib/razorpay.server");
    return { keyId: getKeyId(), environment: getPaymentEnv(), trialDays: TRIAL_DAYS };
  });

export const createSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceKey: string }) => {
    if (!/^[a-z0-9_]{3,64}$/.test(data.priceKey)) throw new Error("Invalid priceKey");
    return data;
  })
  .handler(async ({ data, context }): Promise<CreateResult> => {
    try {
      const rzpMod = await import("@/lib/razorpay.server");
      const { rzp, isPriceKey, CATALOG, getKeyId, getPaymentEnv, mapStatus, TRIAL_DAYS } = rzpMod;
      if (!isPriceKey(data.priceKey)) throw new Error("Unknown plan");

      const environment = getPaymentEnv();
      const plan = CATALOG[data.priceKey];
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Resolve (or create + cache) the Razorpay plan for this price key.
      const { data: cached } = await supabaseAdmin
        .from("billing_plans")
        .select("plan_id")
        .eq("provider", "razorpay")
        .eq("environment", environment)
        .eq("price_key", data.priceKey)
        .maybeSingle();

      let planId = cached?.plan_id as string | undefined;
      if (!planId) {
        const created = await rzp<{ id: string }>("/plans", {
          method: "POST",
          body: {
            period: plan.period,
            interval: 1,
            item: { name: plan.name, amount: plan.amount, currency: plan.currency },
            notes: { price_key: data.priceKey },
          },
        });
        planId = created.id;
        await supabaseAdmin.from("billing_plans").upsert(
          {
            provider: "razorpay",
            environment,
            price_key: data.priceKey,
            plan_id: planId,
            amount: plan.amount,
            currency: plan.currency,
            period: plan.period,
          },
          { onConflict: "provider,environment,price_key" },
        );
      }

      // 2. Free trial = first charge scheduled TRIAL_DAYS from now.
      const startAt = Math.floor(Date.now() / 1000) + TRIAL_DAYS * 24 * 60 * 60;

      const { data: userData } = await context.supabase.auth.getUser();
      const email = userData.user?.email ?? undefined;

      const subscription = await rzp<{
        id: string;
        status: string;
        short_url?: string;
        current_start?: number | null;
        current_end?: number | null;
        charge_at?: number | null;
        customer_id?: string | null;
      }>("/subscriptions", {
        method: "POST",
        body: {
          plan_id: planId,
          total_count: plan.totalCount,
          quantity: 1,
          customer_notify: 1,
          start_at: startAt,
          notes: { userId: context.userId, price_key: data.priceKey },
          ...(email && { notify_info: { notify_email: email } }),
        },
      });

      // 3. Record it immediately so the UI has something to poll against.
      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: context.userId,
          provider: "razorpay",
          provider_subscription_id: subscription.id,
          provider_customer_id: subscription.customer_id ?? null,
          price_id: data.priceKey,
          product_id: planId,
          status: mapStatus(subscription.status),
          current_period_start: null,
          current_period_end: new Date(startAt * 1000).toISOString(),
          cancel_at_period_end: false,
          short_url: subscription.short_url ?? null,
          environment,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider,provider_subscription_id" },
      );

      return {
        subscriptionId: subscription.id,
        keyId: getKeyId(),
        environment,
        shortUrl: subscription.short_url ?? null,
      };
    } catch (error) {
      const { getRazorpayErrorMessage } = await import("@/lib/razorpay.server");
      return { error: getRazorpayErrorMessage(error) };
    }
  });

/**
 * Pull the latest state for a subscription straight from Razorpay and write it
 * to the database. Called right after checkout so access unlocks without
 * waiting for the webhook.
 */
export const syncSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { subscriptionId: string }) => {
    if (!/^sub_[A-Za-z0-9]+$/.test(data.subscriptionId)) throw new Error("Invalid subscriptionId");
    return data;
  })
  .handler(async ({ data, context }): Promise<OkResult> => {
    try {
      const { rzp, mapStatus, getPaymentEnv } = await import("@/lib/razorpay.server");
      const sub = await rzp<any>(`/subscriptions/${data.subscriptionId}`);
      if (sub?.notes?.userId && sub.notes.userId !== context.userId) {
        throw new Error("Subscription does not belong to this account");
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const periodEnd = sub.current_end ?? sub.charge_at ?? null;

      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: context.userId,
          provider: "razorpay",
          provider_subscription_id: sub.id,
          provider_customer_id: sub.customer_id ?? null,
          price_id: sub.notes?.price_key ?? "dwt_pro_monthly_inr",
          product_id: sub.plan_id ?? null,
          status: mapStatus(sub.status),
          current_period_start: sub.current_start ? new Date(sub.current_start * 1000).toISOString() : null,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          cancel_at_period_end: !!sub.end_at && sub.status !== "cancelled",
          short_url: sub.short_url ?? null,
          environment: getPaymentEnv(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider,provider_subscription_id" },
      );
      return { ok: true };
    } catch (error) {
      const { getRazorpayErrorMessage } = await import("@/lib/razorpay.server");
      return { error: getRazorpayErrorMessage(error) };
    }
  });

/** Cancel — at the end of the paid cycle by default, immediately on request. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { immediate?: boolean }) => data ?? {})
  .handler(async ({ data, context }): Promise<OkResult> => {
    const { data: row, error } = await context.supabase
      .from("subscriptions")
      .select("provider_subscription_id, status")
      .eq("user_id", context.userId)
      .eq("provider", "razorpay")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!row?.provider_subscription_id) return { error: "No subscription found" };

    try {
      const { rzp, mapStatus, getPaymentEnv } = await import("@/lib/razorpay.server");
      const updated = await rzp<any>(`/subscriptions/${row.provider_subscription_id}/cancel`, {
        method: "POST",
        body: { cancel_at_cycle_end: data.immediate ? 0 : 1 },
      });

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("subscriptions")
        .update({
          status: mapStatus(updated.status),
          cancel_at_period_end: !data.immediate,
          updated_at: new Date().toISOString(),
        })
        .eq("provider", "razorpay")
        .eq("provider_subscription_id", row.provider_subscription_id)
        .eq("environment", getPaymentEnv());

      return { ok: true };
    } catch (err) {
      const { getRazorpayErrorMessage } = await import("@/lib/razorpay.server");
      return { error: getRazorpayErrorMessage(err) };
    }
  });

/**
 * Razorpay cannot change the plan on a running subscription, so switching is:
 * cancel the current one at the end of its cycle, then start the new plan at
 * that same moment. The user keeps uninterrupted access and is never
 * double-charged.
 */
export const switchSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { targetPriceKey: string }) => {
    if (!/^[a-z0-9_]{3,64}$/.test(data.targetPriceKey)) throw new Error("Invalid priceKey");
    return data;
  })
  .handler(async ({ data, context }): Promise<OkResult> => {
    const { data: row, error } = await context.supabase
      .from("subscriptions")
      .select("provider_subscription_id, status, current_period_end, price_id")
      .eq("user_id", context.userId)
      .eq("provider", "razorpay")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!row?.provider_subscription_id) return { error: "No subscription found" };
    if (!["active", "trialing", "past_due"].includes(row.status as string)) {
      return { error: `Cannot switch a subscription in status: ${row.status}` };
    }
    if (row.price_id === data.targetPriceKey) return { error: "You are already on that plan" };

    try {
      const rzpMod = await import("@/lib/razorpay.server");
      const { rzp, isPriceKey, CATALOG, mapStatus, getPaymentEnv } = rzpMod;
      if (!isPriceKey(data.targetPriceKey)) return { error: "Unknown plan" };

      const environment = getPaymentEnv();
      const plan = CATALOG[data.targetPriceKey];
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: cached } = await supabaseAdmin
        .from("billing_plans")
        .select("plan_id")
        .eq("provider", "razorpay")
        .eq("environment", environment)
        .eq("price_key", data.targetPriceKey)
        .maybeSingle();

      let planId = cached?.plan_id as string | undefined;
      if (!planId) {
        const created = await rzp<{ id: string }>("/plans", {
          method: "POST",
          body: {
            period: plan.period,
            interval: 1,
            item: { name: plan.name, amount: plan.amount, currency: plan.currency },
            notes: { price_key: data.targetPriceKey },
          },
        });
        planId = created.id;
        await supabaseAdmin.from("billing_plans").upsert(
          {
            provider: "razorpay",
            environment,
            price_key: data.targetPriceKey,
            plan_id: planId,
            amount: plan.amount,
            currency: plan.currency,
            period: plan.period,
          },
          { onConflict: "provider,environment,price_key" },
        );
      }

      // Stop the old plan at the end of the paid cycle.
      await rzp(`/subscriptions/${row.provider_subscription_id}/cancel`, {
        method: "POST",
        body: { cancel_at_cycle_end: 1 },
      });

      // Start the new plan exactly where the old one ends (min 15 min ahead).
      const minStart = Math.floor(Date.now() / 1000) + 15 * 60;
      const endSeconds = row.current_period_end
        ? Math.floor(new Date(row.current_period_end).getTime() / 1000)
        : minStart;
      const startAt = Math.max(endSeconds, minStart);

      const created = await rzp<any>("/subscriptions", {
        method: "POST",
        body: {
          plan_id: planId,
          total_count: plan.totalCount,
          quantity: 1,
          customer_notify: 1,
          start_at: startAt,
          notes: { userId: context.userId, price_key: data.targetPriceKey },
        },
      });

      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: context.userId,
          provider: "razorpay",
          provider_subscription_id: created.id,
          price_id: data.targetPriceKey,
          product_id: planId,
          status: mapStatus(created.status),
          current_period_end: new Date(startAt * 1000).toISOString(),
          cancel_at_period_end: false,
          short_url: created.short_url ?? null,
          environment,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider,provider_subscription_id" },
      );

      return { ok: true };
    } catch (err) {
      const { getRazorpayErrorMessage } = await import("@/lib/razorpay.server");
      return { error: getRazorpayErrorMessage(err) };
    }
  });

/* ------------------------------------------------------------------ */
/* Standard Checkout — one-time orders                                 */
/* ------------------------------------------------------------------ */

type OrderResult =
  | {
      orderId: string;
      amount: number;
      currency: string;
      keyId: string;
      environment: "sandbox" | "live";
      priceKey: string;
    }
  | { error: string };

/** Creates a Razorpay order server-side for Standard Checkout. */
export const createPaymentOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceKey: string }) => {
    if (!/^[a-z0-9_]{3,64}$/.test(data.priceKey)) throw new Error("Invalid priceKey");
    return data;
  })
  .handler(async ({ data, context }): Promise<OrderResult> => {
    try {
      const { createOrder, isPriceKey, CATALOG, getKeyId, getPaymentEnv } = await import("@/lib/razorpay.server");
      if (!isPriceKey(data.priceKey)) throw new Error("Unknown plan");
      const plan = CATALOG[data.priceKey];

      const order = await createOrder({
        amount: plan.amount,
        currency: plan.currency,
        receipt: `dwt_${Date.now().toString(36)}`,
        notes: { userId: context.userId, price_key: data.priceKey },
      });

      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: getKeyId(),
        environment: getPaymentEnv(),
        priceKey: data.priceKey,
      };
    } catch (error) {
      const { getRazorpayErrorMessage } = await import("@/lib/razorpay.server");
      return { error: getRazorpayErrorMessage(error) };
    }
  });

/**
 * Verifies the signature returned by Razorpay Checkout. This confirms the
 * payment attempt is authentic — access is still granted only by the
 * `payment.captured` webhook.
 */
export const verifyPaymentSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; paymentId: string; signature: string }) => {
    if (!/^order_[A-Za-z0-9]+$/.test(data.orderId)) throw new Error("Invalid orderId");
    if (!/^pay_[A-Za-z0-9]+$/.test(data.paymentId)) throw new Error("Invalid paymentId");
    if (!/^[a-f0-9]{40,128}$/.test(data.signature)) throw new Error("Invalid signature");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ verified: boolean } | { error: string }> => {
    try {
      const { verifyCheckoutSignature, fetchOrder } = await import("@/lib/razorpay.server");
      const ok = await verifyCheckoutSignature(data);
      if (!ok) return { verified: false };

      const order = await fetchOrder(data.orderId);
      if (order.notes?.userId && order.notes.userId !== context.userId) {
        return { error: "Order does not belong to this account" };
      }
      return { verified: true };
    } catch (error) {
      const { getRazorpayErrorMessage } = await import("@/lib/razorpay.server");
      return { error: getRazorpayErrorMessage(error) };
    }
  });
