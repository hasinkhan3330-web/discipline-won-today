import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useEntitlement — the ONE source of truth for premium access.
 *
 * Everything is computed by public.get_entitlement() on the database clock.
 * Access is granted only by a backend-verified subscription or a claimed,
 * unexpired 3-day trial. Device time, localStorage and client booleans are
 * never trusted.
 */

export type AccessStatus = "trial" | "subscribed" | "expired" | "basic";

export type EntitlementRow = {
  is_premium: boolean;
  premium_access: boolean;
  access_status: AccessStatus;
  trial_day: number | null;
  remaining_seconds: number | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_status: string | null;
  subscription_provider: string | null;
  plan: string | null;
  current_period_end: string | null;
  server_now: string;
};

export type Entitlement = {
  /** Backend-verified paid subscription only. */
  isPremium: boolean;
  /** Subscription OR active trial — what the feature gates use. */
  premiumAccess: boolean;
  accessStatus: AccessStatus;
  trialDay: number;
  /** Seconds left in the trial, counted down locally from the server value. */
  remainingSeconds: number;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
  subscriptionProvider: string | null;
  plan: string | null;
  currentPeriodEnd: string | null;
  isLoading: boolean;
  /** True the first time this device sees a freshly-started trial. */
  justStartedTrial: boolean;
  dismissTrialWelcome: () => void;
  clockSkewMs: number;
  refresh: () => Promise<void>;
};

const WELCOME_KEY = "axen.trial.welcomed";

export function useEntitlement(userId: string | null): Entitlement {
  const [row, setRow] = useState<EntitlementRow | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [justStarted, setJustStarted] = useState(false);
  const inflight = useRef(false);
  const initialised = useRef<string | null>(null);
  const fetchedAt = useRef<number>(Date.now());

  const refresh = useCallback(async () => {
    if (!userId) { setRow(null); setLoading(false); return; }
    if (inflight.current) return;
    inflight.current = true;
    try {
      // Idempotent: starts the 72h trial on the first authenticated session and
      // returns the existing trial on every later call. Never extends it.
      if (initialised.current !== userId) {
        initialised.current = userId;
        try { await supabase.rpc("initialize_trial" as never); } catch { /* read-only fallback below */ }
      }
      const { data, error } = await supabase.rpc("get_entitlement" as never);
      if (!error && data) {
        const r = (Array.isArray(data) ? data[0] : data) as EntitlementRow | undefined;
        if (r) {
          setRow(r);
          fetchedAt.current = Date.now();
          if (r.access_status === "trial" && typeof window !== "undefined") {
            const seen = window.localStorage.getItem(`${WELCOME_KEY}.${userId}`);
            if (!seen) setJustStarted(true);
          }
        }
      }
    } catch {
      /* keep the previous verdict; never self-grant on the client */
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  // Local 1s countdown while a trial is running (display only).
  useEffect(() => {
    if (!row || row.access_status !== "trial") return;
    const id = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [row]);

  useEffect(() => {
    if (!userId) return;

    // Realtime: verified purchases flip access instantly.
    const ch = supabase.channel(`ent_${userId}_${Math.random().toString(36).slice(2)}`);
    ch.on("postgres_changes" as never,
      { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
      () => refresh())
      .on("postgres_changes" as never,
        { event: "*", schema: "public", table: "entitlements", filter: `user_id=eq.${userId}` },
        () => refresh())
      .subscribe();

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

    // Periodic re-check while the app stays open.
    const poll = window.setInterval(refresh, 5 * 60 * 1000);

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("subscription:refresh", onPayment);
      window.removeEventListener("subscription:active", onPayment);
      window.clearInterval(poll);
      timers.forEach(clearTimeout);
    };
  }, [userId, refresh]);

  // Re-verify with the server at the exact expiry moment.
  useEffect(() => {
    if (!row || row.access_status !== "trial") return;
    const ms = Math.max(0, (row.remaining_seconds ?? 0) * 1000 - (Date.now() - fetchedAt.current)) + 1200;
    const id = window.setTimeout(refresh, ms);
    return () => window.clearTimeout(id);
  }, [row, refresh]);

  const dismissTrialWelcome = useCallback(() => {
    setJustStarted(false);
    if (userId && typeof window !== "undefined") {
      window.localStorage.setItem(`${WELCOME_KEY}.${userId}`, "1");
    }
  }, [userId]);

  return useMemo<Entitlement>(() => {
    const elapsed = Math.floor((Date.now() - fetchedAt.current) / 1000);
    const remaining = Math.max(0, (row?.remaining_seconds ?? 0) - elapsed);
    const trialing = row?.access_status === "trial" && remaining > 0;
    return {
      isPremium: !!row?.is_premium,
      premiumAccess: !!row && (row.is_premium || trialing),
      accessStatus: (row?.access_status ?? "basic") as AccessStatus,
      trialDay: row?.trial_day ?? 0,
      remainingSeconds: remaining,
      trialStartedAt: row?.trial_started_at ?? null,
      trialEndsAt: row?.trial_ends_at ?? null,
      subscriptionStatus: row?.subscription_status ?? null,
      subscriptionProvider: row?.subscription_provider ?? null,
      plan: row?.plan ?? null,
      currentPeriodEnd: row?.current_period_end ?? null,
      isLoading: isLoading || (!!userId && row === null),
      justStartedTrial: justStarted && trialing,
      dismissTrialWelcome,
      clockSkewMs: row ? new Date(row.server_now).getTime() - Date.now() : 0,
      refresh,
    };
    // `tick` drives the 1s countdown recompute.
  }, [row, isLoading, userId, refresh, tick, justStarted, dismissTrialWelcome]);
}
