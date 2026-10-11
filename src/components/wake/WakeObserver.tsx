import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { readWakeState } from "@/lib/wake.functions";
import { supabase } from "@/integrations/supabase/client";
import { webAlarmScheduler } from "@/lib/web-alarm-scheduler";

export function WakeObserver() {
  const router = useRouter();
  const read = useServerFn(readWakeState);
  useEffect(() => {
    let active = true, busy = false;
    const check = async () => {
      if (busy || !active) return;
      busy = true;
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const state = await read();
        if (!active) return;
        webAlarmScheduler.synchronize(state);
        if (state.event?.status === "ringing" && router.state.location.pathname !== "/alarm") await router.navigate({ to: "/alarm", replace: true });
      } catch { /* alarm page and readiness report connection errors */ }
      finally { busy = false; }
    };
    void check();
    const interval = window.setInterval(check, 10000);
    const unsubscribe = router.subscribe("onResolved", () => void check());
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => { active = false; clearInterval(interval); unsubscribe(); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [router, read]);
  return null;
}