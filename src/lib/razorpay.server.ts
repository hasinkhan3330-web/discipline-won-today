/**
 * Server-only Razorpay REST client.
 *
 * Razorpay's Node SDK is not Worker-safe, so we talk to the REST API directly
 * with fetch + HTTP Basic auth (key_id:key_secret). Every helper here must only
 * ever run inside a server function handler or a server route handler.
 */

export type PaymentEnv = "sandbox" | "live";

const API = "https://api.razorpay.com/v1";

function env(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

export function getKeyId(): string {
  return env("RAZORPAY_KEY_ID");
}

/** Razorpay test keys are prefixed rzp_test_, live keys rzp_live_. */
export function getPaymentEnv(): PaymentEnv {
  return getKeyId().startsWith("rzp_live_") ? "live" : "sandbox";
}

function authHeader(): string {
  const raw = `${env("RAZORPAY_KEY_ID")}:${env("RAZORPAY_KEY_SECRET")}`;
  return `Basic ${btoa(raw)}`;
}

export async function rzp<T = any>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const qs = init.query ? `?${new URLSearchParams(init.query).toString()}` : "";
  const res = await fetch(`${API}${path}${qs}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Razorpay ${init.method ?? "GET"} ${path} failed [${res.status}]: ${text}`);
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.description || parsed?.error?.reason || text;
    } catch { /* keep raw text */ }
    throw new Error(`Razorpay request failed [${res.status}]: ${message}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function getRazorpayErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Razorpay request failed";
}

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export type PriceKey = "dwt_pro_monthly_inr" | "dwt_pro_yearly_inr";

export const CATALOG: Record<
  PriceKey,
  { name: string; amount: number; currency: "INR"; period: "monthly" | "yearly"; totalCount: number }
> = {
  dwt_pro_monthly_inr: {
    name: "DWT PRO — Monthly",
    amount: 4900, // ₹49.00 in paise
    currency: "INR",
    period: "monthly",
    totalCount: 120, // 10 years of monthly cycles
  },
  dwt_pro_yearly_inr: {
    name: "DWT PRO — Yearly",
    amount: 99900, // ₹999.00 in paise
    currency: "INR",
    period: "yearly",
    totalCount: 10,
  },
};

export function isPriceKey(value: string): value is PriceKey {
  return Object.prototype.hasOwnProperty.call(CATALOG, value);
}

/** Razorpay subscription status -> the app's provider-neutral status. */
export function mapStatus(status: string): string {
  switch (status) {
    case "created":
      return "incomplete";
    case "authenticated":
      return "trialing";
    case "active":
      return "active";
    case "pending":
    case "halted":
      return "past_due";
    case "paused":
      return "paused";
    case "cancelled":
    case "completed":
    case "expired":
      return "canceled";
    default:
      return status;
  }
}

export const TRIAL_DAYS = 3;

/* ------------------------------------------------------------------ */
/* Standard Checkout (Orders)                                          */
/* ------------------------------------------------------------------ */

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string | null;
  notes?: Record<string, string>;
};

/** Creates a one-time order for Razorpay Standard Checkout. */
export async function createOrder(input: {
  amount: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  return rzp<RazorpayOrder>("/orders", {
    method: "POST",
    body: {
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt.slice(0, 40),
      payment_capture: 1,
      notes: input.notes,
    },
  });
}

export async function fetchOrder(orderId: string): Promise<RazorpayOrder> {
  return rzp<RazorpayOrder>(`/orders/${orderId}`);
}

/**
 * Verifies the checkout handler signature:
 * HMAC_SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET).
 */
export async function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<boolean> {
  const { createHmac, timingSafeEqual } = await import("crypto");
  const expected = createHmac("sha256", env("RAZORPAY_KEY_SECRET"))
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  const a = Buffer.from(input.signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** How long one paid cycle lasts, as an ISO timestamp from `from`. */
export function periodEndFor(priceKey: PriceKey, from: Date = new Date()): string {
  const end = new Date(from);
  if (CATALOG[priceKey].period === "yearly") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end.toISOString();
}
