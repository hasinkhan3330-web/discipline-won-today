/** DWT PRO catalog. Billing is handled exclusively by Google Play Billing. */

export type Cycle = "monthly" | "yearly";

export const PRICING: Record<Cycle, { priceKey: string; display: string; sub: string; save?: string }> = {
  monthly: {
    priceKey: "dwt_pro_monthly_play",
    display: "₹49 / month",
    sub: "Billed monthly by Google Play after your free trial",
  },
  yearly: {
    priceKey: "dwt_pro_yearly_play",
    display: "₹999 / year",
    sub: "Billed yearly by Google Play after your free trial",
    save: "SAVE 30%",
  },
};

export const TRIAL_DAYS = 3;

export function planLabelFor(priceId?: string | null): string {
  if (!priceId) return "DWT PRO";
  return priceId.includes("yearly") ? "DWT PRO · YEARLY" : "DWT PRO · MONTHLY";
}
