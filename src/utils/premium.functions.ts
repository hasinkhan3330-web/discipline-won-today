import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuoteCombo = { p: string; q: string; img: string };

// Server-side entitlement: paid active/past_due subscription, or canceled but
// still inside its paid period. Trial rows never grant premium access.
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
    if (["active", "past_due"].includes(s.status) && notExpired) return true;
    return s.status === "canceled" && end !== null && end > now;
  });
  return active;
}

/** Entitlement flag for UI gating. Authoritative, computed server-side. */
export const getEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    entitled: await isEntitled(context.supabase, context.userId),
  }));

/**
 * Premium quote content. The legend library lives in a server-only module and
 * is never shipped in the client bundle. Unentitled users still get the legend
 * photo + name, but the quote text is replaced by same-length filler that is
 * rendered blurred — the real words never leave the server.
 */
const FILLER_WORDS = [
  "discipline", "focus", "rise", "silent", "power", "every", "morning", "grind",
  "never", "stop", "believe", "become", "stronger", "today", "again", "forward",
];

function maskQuote(q: string): string {
  const words = q.split(/\s+/);
  return words.map((w, i) => FILLER_WORDS[(i * 7 + w.length) % FILLER_WORDS.length]).join(" ");
}

export const getPremiumQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const entitled = await isEntitled(context.supabase, context.userId);
    const { dayCombo, rot, LEGENDS } = await import("@/constants/legends.server");
    const now = new Date();
    const dayIdx = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
    const shape = (c: QuoteCombo): QuoteCombo => (entitled ? c : { ...c, q: maskQuote(c.q) });
    return {
      dayIdx,
      locked: !entitled,
      todayNumber: rot(dayIdx, LEGENDS.length) + 1,
      today: shape(dayCombo(dayIdx) as QuoteCombo),
      upcoming: Array.from({ length: 30 }, (_, k) => shape(dayCombo(dayIdx + k + 1) as QuoteCombo)),
    };
  });

