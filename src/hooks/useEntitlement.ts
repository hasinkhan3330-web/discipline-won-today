import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useEntitlement — the ONE source of truth for premium access.
 *
 * Everything is computed by public.get_entitlement() using the DATABASE clock:
 * the trial window is stamped server-side (idempotent, never reset by
 * reinstall / logout / new device / cache clear) and a paid subscription
 * always overrides an expired trial. The device clock is only ever used to
 * render a countdown, never to decide access.
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

export type TrialDay = 1 | 2 | 3 | "expired" | null;

export type Entitlement = {
  isPremium: boolean;
  trialDay: TrialDay;
  trialEndsAt: string | null;
  trialStartedAt: string | null;
  subscriptionStatus: string | null;
  subscriptionProvider: string | null;
  plan: string | null;
  currentPeriodEnd: string | null;
  isLoading: boolean;
  /** Milliseconds to add to Date.now() to approximate server time (display only). */
  clockSkewMs: number;
  refresh: () => Promise<void>;
};

/** Dev-only simulation. Never active in a production build. */
export type SimMode = "off" | "day1" | "day2" | "day3" | "expired" | "active-sub" | "expired-sub";
const SIM_KEY = "axen.entitlement.sim";

export function getSimMode(): SimMode {
  if (!import.meta.env.DEV || typeof window === "undefined") return "off";
  return (window.localStorage.getItem(SIM_KEY) as SimMode | null) ?? "off";
}

export function setSimMode(mode: SimMode) {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  if (mode === "off") window.localStorage.removeItem(SIM_KEY);
  else window.localStorage.setItem(SIM_KEY, mode);
  window.dispatchEvent(new Event("subscription:refresh"));
}

function applySim(row: EntitlementRow, mode: SimMode): EntitlementRow {
  if (mode === "off") return row;
  const now = new Date(row.server_now).getTime();
  const day = (d: number) => ({
    ...row,
    is_premium: true,
    trial_day: d,
    trial_started_at: new Date(now - (d - 1) * 86400000).toISOString(),
    trial_ends_at: new Date(now + (4 - d) * 86400000).toISOString(),
    subscription_status: null,
    current_period_end: null,
  });
  switch (mode) {
    case "day1": return day(1);
    case "day2": return day(2);
    case "day3": return day(3);
    case "expired":
      return { ...row, is_premium: false, trial_day: 0, trial_ends_at: new Date(now - 86400000).toISOString(), subscription_status: null, current_period_end: null };
    case "active-sub":
      return { ...row, is_premium: true, trial_day: 0, trial_ends_at: new Date(now - 86400000).toISOString(), subscription_status: "active", current_period_end: new Date(now + 30 * 86400000).toISOString() };
    case "expired-sub":
      return { ...row, is_premium: false, trial_day: 0, trial_ends_at: new Date(now - 10 * 86400000).toISOString(), subscription_status: "expired", current_period_end: new Date(now - 86400000).toISOString() };
    default: return row;
  }
}

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
        if (r) setRow(applySim(r, getSimMode()));
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
    const trialDay: TrialDay = row?.trial_day == null
      ? null
      : row.trial_day === 0
        ? "expired"
        : (Math.min(3, Math.max(1, row.trial_day)) as 1 | 2 | 3);
    return {
      isPremium: !!row?.is_premium,
      trialDay,
      trialEndsAt: row?.trial_ends_at ?? null,
      trialStartedAt: row?.trial_started_at ?? null,
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
