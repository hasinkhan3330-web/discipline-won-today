import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionRow = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  short_url: string | null;
};

export function useSubscription(userId: string | null) {
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setSub(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("status, price_id, current_period_end, cancel_at_period_end, short_url")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSub((data as SubscriptionRow) || null);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`subs_${userId}_${Math.random().toString(36).slice(2)}`);
    ch.on(
      "postgres_changes" as never,
      { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
      () => load()
    ).subscribe();

    // Refetch when the user returns to the tab (checkout overlay).
    const onFocus = () => load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    // After checkout completes, the webhook writes the row asynchronously.
    // Poll briefly so the tabs unlock without a manual refresh.
    let timers: ReturnType<typeof setTimeout>[] = [];
    const onCheckout = () => {
      timers.forEach(clearTimeout);
      timers = [1000, 2500, 4000, 6000, 9000, 13000, 18000, 25000].map(ms => setTimeout(load, ms));
    };
    window.addEventListener("subscription:refresh", onCheckout);

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("subscription:refresh", onCheckout);
      timers.forEach(clearTimeout);
    };
  }, [userId, load]);

  const isActive = !!sub && (() => {
    const notExpired = !sub.current_period_end || new Date(sub.current_period_end) > new Date();
    if (["active", "trialing", "past_due"].includes(sub.status) && notExpired) return true;
    if (sub.status === "canceled" && sub.current_period_end && new Date(sub.current_period_end) > new Date()) return true;
    return false;
  })();

  return { sub, loading, isActive, reload: load };
}
