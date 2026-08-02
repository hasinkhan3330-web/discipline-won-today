/** DWT PRO catalog as shown to the buyer. Razorpay bills in INR only. */

export type Cycle = "monthly" | "yearly";

export const PRICING: Record<Cycle, { priceKey: string; display: string; sub: string; save?: string }> = {
  monthly: {
    priceKey: "dwt_pro_monthly_inr",
    display: "₹49 / month",
    sub: "Billed monthly after your free trial",
  },
  yearly: {
    priceKey: "dwt_pro_yearly_inr",
    display: "₹999 / year",
    sub: "Billed yearly after your free trial",
    save: "SAVE 30%",
  },
};

export const TRIAL_DAYS = 3;

export function planLabelFor(priceId?: string | null): string {
  if (!priceId) return "DWT PRO";
  return priceId.includes("yearly") ? "DWT PRO · YEARLY" : "DWT PRO · MONTHLY";
}
