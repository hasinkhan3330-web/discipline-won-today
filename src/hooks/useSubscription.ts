import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

export type SubscriptionRow = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export function useSubscription(userId: string | null) {
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setSub(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("status, price_id, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .eq("environment", getPaddleEnvironment())
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
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  const isActive = !!sub && (() => {
    const notExpired = !sub.current_period_end || new Date(sub.current_period_end) > new Date();
    if (["active", "trialing", "past_due"].includes(sub.status) && notExpired) return true;
    if (sub.status === "canceled" && sub.current_period_end && new Date(sub.current_period_end) > new Date()) return true;
    return false;
  })();

  return { sub, loading, isActive, reload: load };
}
