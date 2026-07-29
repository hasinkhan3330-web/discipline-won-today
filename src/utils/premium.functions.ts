import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuoteCombo = { p: string; q: string; img: string };

// Server-side entitlement: active/trialing/past_due (or canceled but still in
// period) subscription in ANY environment, OR an app trial that has not expired.
// Client state cannot influence this — it is derived from the bearer token's user.
async function isEntitled(supabase: any, userId: string): Promise<boolean> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  const now = Date.now();
  const active = (sub ?? []).some((s: any) => {
    const end = s.current_period_end ? new Date(s.current_period_end).getTime() : null;
    const notExpired = end === null || end > now;
    if (["active", "trialing", "past_due"].includes(s.status) && notExpired) return true;
    return s.status === "canceled" && end !== null && end > now;
  });
  if (active) return true;

  const { data: trial } = await supabase
    .from("app_trials")
    .select("trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();
  return !!trial?.trial_ends_at && new Date(trial.trial_ends_at).getTime() > now;
}

/** Entitlement flag for UI gating. Authoritative, computed server-side. */
export const getEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    entitled: await isEntitled(context.supabase, context.userId),
  }));

/**
 * Premium quote content. The legend library lives in a server-only module and
 * is never shipped in the client bundle — unentitled users get a 403 instead.
 */
export const getPremiumQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isEntitled(context.supabase, context.userId))) {
      throw new Response("Subscription required", { status: 403 });
    }
    const { dayCombo, rot, LEGENDS } = await import("@/constants/legends.server");
    const now = new Date();
    const dayIdx = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
    return {
      dayIdx,
      todayNumber: rot(dayIdx, LEGENDS.length) + 1,
      today: dayCombo(dayIdx) as QuoteCombo,
      upcoming: Array.from({ length: 30 }, (_, k) => dayCombo(dayIdx + k + 1) as QuoteCombo),
    };
  });
