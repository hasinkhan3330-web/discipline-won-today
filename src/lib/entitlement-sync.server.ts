import { createHash } from "crypto";

/**
 * Server-only mirror of a verified store entitlement into `public.entitlements`.
 * Only backend-verified state reaches this table; clients can read but never write it.
 * No raw purchase tokens are stored — only a salted-free SHA-256 digest.
 */
export function tokenHash(parts: string): string {
  return createHash("sha256").update(parts).digest("hex");
}

export type VerifiedEntitlement = {
  active: boolean;
  productId?: string | null;
  expiresAt?: string | null;
  originalAppUserId?: string | null;
};

export async function mirrorEntitlement(userId: string, ent: VerifiedEntitlement) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const hash = ent.active
    ? tokenHash(`rc:${ent.originalAppUserId ?? userId}:${ent.productId ?? "unknown"}`)
    : null;

  const { error } = await supabaseAdmin.from("entitlements").upsert(
    {
      user_id: userId,
      subscription_status: ent.active ? "active" : "none",
      subscription_expires_at: ent.active ? (ent.expiresAt ?? null) : null,
      product_id: ent.active ? (ent.productId ?? null) : null,
      purchase_token_hash: hash,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (error) console.error("entitlement mirror failed", error.message);
}

/**
 * Idempotency guard for store notifications: returns false when this event id
 * has already been processed, so duplicate RTDN deliveries can never re-grant.
 */
export async function claimNotification(eventId: string, provider: string, eventType: string, userId: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("billing_notifications")
    .insert({ event_id: eventId, provider, event_type: eventType, user_id: userId });
  if (error) return false; // unique violation → already processed
  return true;
}
