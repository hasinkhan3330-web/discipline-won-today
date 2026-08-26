import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

const envSchema = z.enum(["sandbox", "live"]);

const createSchema = z.object({
  cycle: z.enum(["monthly", "yearly"]),
  returnUrl: z.string().url(),
  environment: envSchema,
});

const confirmSchema = z.object({
  sessionId: z.string().min(1),
  environment: envSchema,
});

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0]!.id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0]!;
      if (options.userId && customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

/** Creates an embedded Stripe Checkout session for international card payments. */
export const createStripeCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const { STRIPE_PRICE } = await import("@/lib/pricing");
      const stripe = createStripeClient(data.environment as StripeEnv);

      const prices = await stripe.prices.list({ lookup_keys: [STRIPE_PRICE[data.cycle]] });
      if (!prices.data.length) return { error: "Price not found" };
      const price = prices.data[0]!;

      const email = (context.claims as { email?: string } | null)?.email;
      const customerId = await resolveOrCreateCustomer(stripe, { email, userId: context.userId });

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        metadata: { userId: context.userId, cycle: data.cycle },
        subscription_data: { metadata: { userId: context.userId, cycle: data.cycle } },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Verifies a completed Stripe Checkout session and records the subscription. */
export const confirmStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => confirmSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ active: boolean; error?: string }> => {
    try {
      const { STRIPE_PRICE } = await import("@/lib/pricing");
      const stripe = createStripeClient(data.environment as StripeEnv);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["subscription"],
      });

      if (session.metadata?.["userId"] !== context.userId) {
        return { active: false, error: "Payment could not be verified." };
      }
      if (session.status !== "complete" || session.payment_status === "unpaid") {
        return { active: false, error: "Payment is not completed yet." };
      }

      const cycle = session.metadata?.["cycle"] === "yearly" ? "yearly" : "monthly";
      const subscription = typeof session.subscription === "string" ? null : session.subscription;
      const now = new Date();
      const fallbackEnd = new Date(now);
      if (cycle === "yearly") fallbackEnd.setFullYear(fallbackEnd.getFullYear() + 1);
      else fallbackEnd.setMonth(fallbackEnd.getMonth() + 1);

      const item = subscription?.items?.data?.[0] as { current_period_end?: number } | undefined;
      const periodEnd = item?.current_period_end
        ? new Date(item.current_period_end * 1000)
        : fallbackEnd;

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: context.userId,
          provider: "stripe",
          provider_subscription_id:
            (typeof session.subscription === "string" ? session.subscription : subscription?.id) ??
            session.id,
          provider_customer_id:
            (typeof session.customer === "string" ? session.customer : session.customer?.id) ??
            context.userId,
          price_id: STRIPE_PRICE[cycle],
          product_id: cycle,
          status: subscription?.status ?? "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
          environment: data.environment === "live" ? "live" : "test",
          updated_at: now.toISOString(),
        },
        { onConflict: "provider,provider_subscription_id" },
      );
      if (error) {
        console.error("stripe subscription upsert failed", error.message);
        return { active: false, error: "Payment received but activation failed. Contact support." };
      }

      return { active: true };
    } catch (error) {
      return { active: false, error: getStripeErrorMessage(error) };
    }
  });
