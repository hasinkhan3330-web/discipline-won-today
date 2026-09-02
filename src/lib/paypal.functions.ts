import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * PayPal (international web checkout).
 * Orders are created server-side and captured server-side; entitlement is
 * granted only after PayPal confirms the capture (re-confirmed by webhook).
 */

const cycleSchema = z.object({ cycle: z.enum(["monthly", "yearly"]) });
const captureSchema = z.object({
  orderId: z.string().min(1).max(64),
  cycle: z.enum(["monthly", "yearly"]),
});

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
  if (!res.ok) {
    console.error("paypal token failed", res.status);
    return null;
  }
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

/** Tells the browser which web payment methods are actually configured. */
export const getWebPaymentMethods = createServerFn({ method: "GET" }).handler(async () => ({
  razorpay: !!process.env["RAZORPAY_KEY_ID"] && !!process.env["RAZORPAY_KEY_SECRET"],
  paypal: !!process.env["PAYPAL_CLIENT_ID"] && !!process.env["PAYPAL_CLIENT_SECRET"],
  paypalClientId: process.env["PAYPAL_CLIENT_ID"] ?? null,
}));

export const createPayPalOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => cycleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const token = await accessToken();
    if (!token) return { error: "Payment system loading… Please try again shortly." as const };

    const { AMOUNT_USD, PRICING } = await import("@/lib/pricing");
    const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: `${context.userId}|${data.cycle}`,
            description: `AXEN PRO ${data.cycle}`,
            amount: { currency_code: "USD", value: AMOUNT_USD[data.cycle] },
          },
        ],
        application_context: { brand_name: "AXEN Habit & Discipline", user_action: "PAY_NOW" },
      }),
    });
    if (!res.ok) {
      console.error("paypal order failed", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return { error: "Could not start checkout. Please try again." as const };
    }
    const order = (await res.json()) as { id: string };
    void PRICING;
    return { orderId: order.id };
  });

export const capturePayPalOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => captureSchema.parse(input))
  .handler(async ({ data, context }) => {
    const token = await accessToken();
    if (!token) return { active: false, error: "Payment system loading… Please try again shortly." };

    const res = await fetch(`${apiBase()}/v2/checkout/orders/${encodeURIComponent(data.orderId)}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok || json?.status !== "COMPLETED") {
      console.error("paypal capture failed", res.status, json?.status);
      return { active: false, error: "Payment could not be verified." };
    }

    const unit = json?.purchase_units?.[0];
    const [ownerId, paidCycleRaw] = String(unit?.custom_id ?? "").split("|");
    if (ownerId !== context.userId) return { active: false, error: "Payment could not be verified." };

    const cycle: "monthly" | "yearly" = paidCycleRaw === "yearly" ? "yearly" : "monthly";
    const { AMOUNT_USD, PRICING } = await import("@/lib/pricing");
    const captured = unit?.payments?.captures?.[0];
    const paid = Number(captured?.amount?.value ?? 0);
    if (captured?.amount?.currency_code !== "USD" || paid < Number(AMOUNT_USD[cycle])) {
      return { active: false, error: "Payment could not be verified." };
    }

    const now = new Date();
    const end = new Date(now);
    if (cycle === "yearly") end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: context.userId,
        provider: "paypal",
        provider_subscription_id: data.orderId,
        provider_customer_id: context.userId,
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
    if (error) {
      console.error("paypal subscription upsert failed", error.message);
      return { active: false, error: "Payment received but activation failed. Contact support." };
    }
    return { active: true, expiresAt: end.toISOString() };
  });
