import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MilestoneSealRecord } from "@/lib/milestone-seals";

export function useMilestoneSeals(userId: string | null, coins: number) {
  const [result, setResult] = useState<{ userId: string; seals: MilestoneSealRecord[] }>({ userId: "", seals: [] });
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.rpc("get_my_milestone_seals");
      if (!cancelled && !error) setResult({ userId, seals: data ?? [] });
    };
    void load();
    window.addEventListener("focus", load);
    return () => { cancelled = true; window.removeEventListener("focus", load); };
  }, [userId, coins]);
  return result.userId === userId ? result.seals : [];
}