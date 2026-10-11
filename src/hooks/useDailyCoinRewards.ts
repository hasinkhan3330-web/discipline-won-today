import { useCallback, useEffect, useState } from "react";
import { getDailyCoinRewards, type DailyCoinRewards } from "@/lib/coin-rewards";
export function useDailyCoinRewards() {
  const [daily, setDaily] = useState<DailyCoinRewards | null>(null);
  const refresh = useCallback(() => getDailyCoinRewards().then(setDaily).catch(() => setDaily(null)), []);
  useEffect(() => {
    void refresh();
    const onVisible = () => { if (!document.hidden) void refresh(); };
    const timer = setInterval(onVisible, 30_000);
    window.addEventListener("axen:coin-reward", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); window.removeEventListener("axen:coin-reward", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);
  return { daily, refresh };
}