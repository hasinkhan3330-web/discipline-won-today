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
