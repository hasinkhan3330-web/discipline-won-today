import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Razorpay Standard Checkout (web).
 * Orders are created server-side; entitlement is granted only after the
 * payment signature is verified server-side (and re-confirmed by webhook).
 */

const cycleSchema = z.object({ cycle: z.enum(["monthly", "yearly"]) });

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  cycle: z.enum(["monthly", "yearly"]),
});

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => cycleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const keyId = process.env["RAZORPAY_KEY_ID"];
    const keySecret = process.env["RAZORPAY_KEY_SECRET"];
    if (!keyId || !keySecret) return { error: "Payments are not configured yet." as const };

    const { AMOUNT_PAISE, PRICING } = await import("@/lib/pricing");
    const amount = AMOUNT_PAISE[data.cycle];

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: `dwt_${data.cycle}_${Date.now()}`,
        notes: { user_id: context.userId, cycle: data.cycle, price_id: PRICING[data.cycle].priceKey },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("razorpay order failed", res.status, body.slice(0, 300));
      return { error: "Could not start checkout. Please try again." as const };
    }

    const order = (await res.json()) as { id: string; amount: number; currency: string };
    return { orderId: order.id, amount: order.amount, currency: order.currency, keyId };
  });

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

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => verifySchema.parse(input))
  .handler(async ({ data, context }) => {
    const keyId = process.env["RAZORPAY_KEY_ID"];
    const keySecret = process.env["RAZORPAY_KEY_SECRET"];
    if (!keyId || !keySecret) return { active: false, error: "Payments are not configured yet." };

    const expected = await hmacHex(keySecret, `${data.razorpay_order_id}|${data.razorpay_payment_id}`);
    if (expected !== data.razorpay_signature) {
      return { active: false, error: "Payment could not be verified." };
    }

    // Never trust the client-supplied cycle: read it back from the paid order.
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(data.razorpay_order_id)}`, {
      headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
    });
    if (!orderRes.ok) {
      console.error("razorpay order lookup failed", orderRes.status);
      return { active: false, error: "Payment could not be verified." };
    }
    const order = (await orderRes.json()) as {
      amount_paid?: number;
      amount?: number;
      status?: string;
      notes?: { user_id?: string; cycle?: string };
    };

    if (order.notes?.user_id !== context.userId) {
      return { active: false, error: "Payment could not be verified." };
    }
    if (order.status !== "paid") {
      return { active: false, error: "Payment is not completed yet." };
    }

    const { AMOUNT_PAISE, PRICING } = await import("@/lib/pricing");
    const cycle: "monthly" | "yearly" = order.notes?.cycle === "yearly" ? "yearly" : "monthly";
    if (order.notes?.cycle !== cycle) {
      return { active: false, error: "Payment could not be verified." };
    }
    if ((order.amount_paid ?? 0) < AMOUNT_PAISE[cycle]) {
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
        provider: "razorpay",
        provider_subscription_id: data.razorpay_order_id,
        provider_customer_id: context.userId,
        price_id: PRICING[data.cycle].priceKey,
        product_id: data.cycle,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        cancel_at_period_end: true,
        environment: "live",
        updated_at: now.toISOString(),
      },
      { onConflict: "provider,provider_subscription_id" },
    );
    if (error) {
      console.error("subscription upsert failed", error.message);
      return { active: false, error: "Payment received but activation failed. Contact support." };
    }

    return { active: true, expiresAt: end.toISOString() };
  });
