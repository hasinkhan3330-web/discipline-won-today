import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useEntitlement — the ONE source of truth for premium access.
 *
 * Everything is computed by public.get_entitlement() using the database clock.
 * Only a paid subscription grants premium access.
 */

export type EntitlementRow = {
  is_premium: boolean;
  trial_day: number | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_status: string | null;
  subscription_provider: string | null;
  plan: string | null;
  current_period_end: string | null;
  server_now: string;
};

export type Entitlement = {
  isPremium: boolean;
  subscriptionStatus: string | null;
  subscriptionProvider: string | null;
  plan: string | null;
  currentPeriodEnd: string | null;
  isLoading: boolean;
  /** Milliseconds to add to Date.now() to approximate server time (display only). */
  clockSkewMs: number;
  refresh: () => Promise<void>;
};

export function useEntitlement(userId: string | null): Entitlement {
  const [row, setRow] = useState<EntitlementRow | null>(null);
  const [isLoading, setLoading] = useState(true);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId) { setRow(null); setLoading(false); return; }
    if (inflight.current) return;
    inflight.current = true;
    try {
      const { data, error } = await supabase.rpc("get_entitlement" as never);
      if (!error && data) {
        const r = (Array.isArray(data) ? data[0] : data) as EntitlementRow | undefined;
        if (r) setRow(r);
      }
    } catch {
      /* keep the previous verdict; never self-grant on the client */
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  useEffect(() => {
    if (!userId) return;

    // Realtime: webhook writes to subscriptions / profiles flip access instantly.
    const ch = supabase.channel(`ent_${userId}_${Math.random().toString(36).slice(2)}`);
    ch.on("postgres_changes" as never,
      { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
      () => refresh())
      .on("postgres_changes" as never,
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        () => refresh())
      .subscribe();

    // App foreground + login + post-payment. Bounded backoff, no busy polling.
    let timers: ReturnType<typeof setTimeout>[] = [];
    const onPayment = () => {
      timers.forEach(clearTimeout);
      timers = [1200, 3000, 6000, 10000, 16000].map(ms => setTimeout(refresh, ms));
    };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("subscription:refresh", onPayment);
    window.addEventListener("subscription:active", onPayment);

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("subscription:refresh", onPayment);
      window.removeEventListener("subscription:active", onPayment);
      timers.forEach(clearTimeout);
    };
  }, [userId, refresh]);

  return useMemo<Entitlement>(() => {
    return {
      isPremium: !!row?.is_premium,
      subscriptionStatus: row?.subscription_status ?? null,
      subscriptionProvider: row?.subscription_provider ?? null,
      plan: row?.plan ?? null,
      currentPeriodEnd: row?.current_period_end ?? null,
      isLoading: isLoading || (!!userId && row === null),
      clockSkewMs: row ? new Date(row.server_now).getTime() - Date.now() : 0,
      refresh,
    };
  }, [row, isLoading, userId, refresh]);
}
