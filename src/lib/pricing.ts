/** AXEN PRO catalog. Billing is handled exclusively by Google Play Billing. */

export type Cycle = "monthly" | "yearly";

export const PRICING: Record<Cycle, { priceKey: string; display: string; sub: string; save?: string }> = {
  monthly: {
    priceKey: "dwt_pro_monthly_play",
    display: "₹99 / month",
    sub: "Billed ₹99 monthly by Google Play after your free trial",
  },
  yearly: {
    priceKey: "dwt_pro_yearly_play",
    display: "₹999 / year",
    sub: "Billed ₹999 yearly by Google Play after your free trial",
    save: "SAVE 16%",
  },
};

export const TRIAL_DAYS = 3;

/** Razorpay charges in paise (INR). */
export const AMOUNT_PAISE: Record<Cycle, number> = {
  monthly: 9900,
  yearly: 99900,
};


export function planLabelFor(priceId?: string | null): string {
  if (!priceId) return "AXEN PRO";
  return priceId.includes("yearly") ? "AXEN PRO · YEARLY" : "AXEN PRO · MONTHLY";
}
