import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { readWakeState, claimOfflineWake } from "@/lib/wake.functions";
import { supabase } from "@/integrations/supabase/client";
import { webAlarmScheduler } from "@/lib/web-alarm-scheduler";
import { listenAlarmTaps, markFiringSolved, syncNativeAlarms } from "@/lib/native-alarms";
import { pastWakeCutoff } from "@/lib/native-alarms-core";
import { syncClaims } from "@/lib/offline-wake-claims";
import { WAKE_REASONS } from "@/lib/wake-rules";

export function WakeObserver() {
  const router = useRouter();
  const read = useServerFn(readWakeState);
  const claim = useServerFn(claimOfflineWake);
  useEffect(() => {
    let active = true, busy = false, lastNative = "", force = true;
    const check = async () => {
      if (busy || !active) return;
      busy = true;
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        await syncClaims(c => claim({ data: { ...c, clientNow: new Date().toISOString() } }), (_c, r) => {
          window.dispatchEvent(new Event("axen:wake-updated"));
          if (r.accepted && r.awarded > 0) toast.success(`Offline wake confirmed: +${r.awarded} coins`);
          else if (r.accepted) toast(`Offline wake confirmed. ${WAKE_REASONS[r.result] ?? ""}`.trim());
          else toast.error(`Offline wake claim not accepted (${r.result.replace(/_/g, " ")}).`);
        });
        const state = await read();
        if (!active) return;
        webAlarmScheduler.synchronize(state);
        // Native alarms resync on app open/resume, after edits/solves, or whenever the schedule changes.
        const sig = JSON.stringify([state.settings?.alarm_id, state.settings?.enabled, state.settings?.repeat_daily, state.settings?.next_fire_at, state.event?.id, state.event?.status]);
        if (force || sig !== lastNative) { force = false; lastNative = sig; void syncNativeAlarms(state); }
        const late = state.event?.status === "ringing" && !state.event.is_test && pastWakeCutoff(Date.parse(state.event.scheduled_for), Date.now());
        if (late && state.event) { webAlarmScheduler.stopVerified(); void markFiringSolved(Date.parse(state.event.scheduled_for)); }
        if (!late && state.event?.status === "ringing" && router.state.location.pathname !== "/alarm") await router.navigate({ to: "/alarm", replace: true });
      } catch { /* alarm page and readiness report connection errors */ }
      finally { busy = false; }
    };
    const resync = () => { force = true; void check(); };
    const visible = () => { if (document.visibilityState === "visible") resync(); };
    void check();
    const interval = window.setInterval(check, 10000);
    const unsubscribe = router.subscribe("onResolved", () => void check());
    let stopTaps: () => void = () => {};
    void listenAlarmTaps(() => { if (active) void router.navigate({ to: "/alarm" }); }).then(stop => { if (active) stopTaps = stop; else stop(); });
    window.addEventListener("focus", check);
    window.addEventListener("online", resync);
    window.addEventListener("axen:wake-updated", resync);
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; clearInterval(interval); unsubscribe(); stopTaps(); window.removeEventListener("focus", check); window.removeEventListener("online", resync); window.removeEventListener("axen:wake-updated", resync); document.removeEventListener("visibilitychange", visible); };
  }, [router, read, claim]);
  return null;
}
