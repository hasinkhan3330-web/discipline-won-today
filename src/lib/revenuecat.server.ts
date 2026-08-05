/**
 * Server-side RevenueCat verification.
 * The client never decides entitlement — we always re-read the subscriber
 * from RevenueCat's REST API with the secret key before unlocking PRO.
 */

export const ENTITLEMENT_ID = "premium";

export type VerifiedEntitlement = {
  active: boolean;
  productId: string | null;
  expiresAt: string | null;
  willRenew: boolean;
  store: string | null;
  originalAppUserId: string | null;
};

function secretKey(): string {
  const key = process.env['REVENUECAT_SECRET_KEY'];
  if (!key) throw new Error("REVENUECAT_SECRET_KEY is not configured.");
  return key;
}

export async function fetchSubscriber(appUserId: string): Promise<any> {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`RevenueCat error ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function verifyEntitlement(appUserId: string): Promise<VerifiedEntitlement> {
  const json = await fetchSubscriber(appUserId);
  const sub = json?.subscriber;
  const ent = sub?.entitlements?.[ENTITLEMENT_ID];
  if (!ent) {
    return { active: false, productId: null, expiresAt: null, willRenew: false, store: null, originalAppUserId: sub?.original_app_user_id ?? null };
  }
  const expiresAt: string | null = ent.expires_date ?? null;
  const active = !expiresAt || new Date(expiresAt) > new Date();
  const productId: string | null = ent.product_identifier ?? null;
  const info = productId ? sub?.subscriptions?.[productId] : null;

  return {
    active,
    productId,
    expiresAt,
    willRenew: info ? !info.unsubscribe_detected_at : active,
    store: info?.store ?? "play_store",
    originalAppUserId: sub?.original_app_user_id ?? null,
  };
}

/** Play product id -> internal price key used across the app. */
export function priceKeyFor(productId: string | null): string {
  if (productId && /year|annual/i.test(productId)) return "dwt_pro_yearly_play";
  return "dwt_pro_monthly_play";
}
