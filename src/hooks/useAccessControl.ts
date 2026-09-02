import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AccessState = {
  /** True while the 3-day trial is live OR the user is subscribed. */
  hasAccess: boolean;
  isSubscribed: boolean;
  trialEndsAt: string | null;
  /** False until the first profile read resolves — don't flash gates. */
  ready: boolean;
  reload: () => Promise<void>;
};

/**
 * Global access-control state for the 3-Day Invisible Trial.
 *
 * Source of truth: public.profiles (trial_ends_at / is_subscribed), written
 * ONLY by server-side triggers and payment webhooks. A real-time channel on
 * the user's profile row flips the UI the instant a webhook marks
 * is_subscribed = true — no reload required.
 */
export function useAccessControl(userId: string | null): AccessState {
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setReady(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("trial_ends_at, is_subscribed")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      setTrialEndsAt((data as any).trial_ends_at ?? null);
      setIsSubscribed(!!(data as any).is_subscribed);
    }
    setReady(true);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`access_${userId}_${Math.random().toString(36).slice(2)}`);
    ch.on(
      "postgres_changes" as never,
      { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
      () => load()
    ).subscribe();

    // Checkout completion lands asynchronously via webhook — poll briefly.
    let timers: ReturnType<typeof setTimeout>[] = [];
    const onRefresh = () => {
      timers.forEach(clearTimeout);
      timers = [1000, 2500, 4000, 6000, 9000, 13000].map(ms => setTimeout(load, ms));
    };
    window.addEventListener("subscription:refresh", onRefresh);
    window.addEventListener("focus", load);

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("subscription:refresh", onRefresh);
      window.removeEventListener("focus", load);
      timers.forEach(clearTimeout);
    };
  }, [userId, load]);

  const trialActive = !!trialEndsAt && new Date(trialEndsAt) > new Date();
  const hasAccess = isSubscribed || trialActive || (ready && trialEndsAt === null && !isSubscribed ? false : isSubscribed || trialActive);

  return { hasAccess: isSubscribed || trialActive, isSubscribed, trialEndsAt, ready, reload: load };
}
