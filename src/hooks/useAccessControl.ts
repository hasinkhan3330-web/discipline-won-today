import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AccessState = {
  hasAccess: boolean;
  isSubscribed: boolean;
  /** False until the first profile read resolves — don't flash gates. */
  ready: boolean;
  reload: () => Promise<void>;
};

/**
 * Subscription access fallback. A real-time channel on
 * the user's profile row flips the UI the instant a webhook marks
 * is_subscribed = true — no reload required.
 */
export function useAccessControl(userId: string | null): AccessState {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setReady(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("is_subscribed")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
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
    // Instant unlock: the checkout handler already verified the payment
    // server-side, so lift the gate immediately and reconcile via polling.
    const onActive = () => { setIsSubscribed(true); setReady(true); onRefresh(); };
    window.addEventListener("subscription:active", onActive);
    window.addEventListener("subscription:refresh", onRefresh);
    window.addEventListener("focus", load);

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("subscription:active", onActive);
      window.removeEventListener("subscription:refresh", onRefresh);
      window.removeEventListener("focus", load);
      timers.forEach(clearTimeout);
    };
  }, [userId, load]);

  return { hasAccess: isSubscribed, isSubscribed, ready, reload: load };
}
