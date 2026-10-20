import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { createWakeTest, readWakeState, registerWakePush, wakePushConfiguration } from "@/lib/wake.functions";
import { webAlarmScheduler } from "@/lib/web-alarm-scheduler";
import styles from "./alarm.module.css";

export function WakeReadiness({ onReady }: { onReady: (ready: boolean) => void }) {
  const config = useServerFn(wakePushConfiguration), subscribe = useServerFn(registerWakePush), test = useServerFn(createWakeTest), read = useServerFn(readWakeState), navigate = useNavigate();
  const [permission, setPermission] = useState("Checking");
  const [subscribed, setSubscribed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [overnight, setOvernight] = useState(webAlarmScheduler.ready);
  const [lock, setLock] = useState(false);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const update = () => {
      setPermission("Notification" in window ? Notification.permission : "Unsupported");
      setInstalled(window.matchMedia("(display-mode: standalone)").matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
      setIos(/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
      setLock(webAlarmScheduler.lockActive);
    };
    update();
    if ("serviceWorker" in navigator) void navigator.serviceWorker.getRegistration().then(r => r?.pushManager.getSubscription()).then(s => setSubscribed(!!s)).catch(() => {});
    const timer = setInterval(update, 2000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!overnight && !testing) return;
    let active = true, busy = false;
    const tick = async () => {
      setNow(webAlarmScheduler.now());
      if (busy) return;
      busy = true;
      try {
        const state = await read();
        webAlarmScheduler.synchronize(state);
        if (active && state.event?.status === "ringing") await navigate({ to: "/alarm" });
      } catch { if (active) setError("Connection lost. Keep a backup alarm."); }
      finally { busy = false; }
    };
    void tick(); const timer = setInterval(tick, 1000);
    return () => { active = false; clearInterval(timer); };
  }, [overnight, testing, read, navigate]);
  const start = async () => {
    setError("");
    try { const ready = await webAlarmScheduler.startOvernight(); setOvernight(ready.audio); setLock(ready.wakeLock); onReady(ready.audio); window.dispatchEvent(new Event("axen:wake-updated")); return ready.audio; }
    catch { setError("Audio could not start. Check browser permissions and keep a backup alarm."); return false; }
  };
  const enablePush = async () => {
    setError("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error("Web Push is unsupported on this browser.");
      if (ios && !installed) throw new Error("Install AXEN on your Home Screen first.");
      const permission = await Notification.requestPermission(); setPermission(permission);
      if (permission !== "granted") throw new Error("Notifications are not allowed.");
      const registration = await navigator.serviceWorker.register("/wake-service-worker.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const keys = await config();
      const bytes = Uint8Array.from(atob(keys.publicKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
      const sub = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("Push subscription is incomplete.");
      await subscribe({ data: { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth } });
      setSubscribed(true);
      if (!keys.deliveryActive) setError("Subscription saved. Closed-app delivery awaits approved publication and activation.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Notifications could not be enabled."); }
  };
  const runTest = async () => {
    if (!await start()) return;
    try { await test(); setTesting(true); } catch (reason) { setError(reason instanceof Error ? reason.message : "Test could not start."); }
  };
  return <>
    <section className={styles.readiness} aria-label="Alarm readiness">
      <strong>ALARM READINESS</strong>
      <ul><li><span>Notifications</span><b>{permission}</b></li><li><span>Push subscription</span><b>{subscribed ? "Subscribed · delivery inactive" : "Not subscribed"}</b></li>{ios && <li><span>Home Screen installation</span><b>{installed ? "Installed" : "Required for push"}</b></li>}<li><span>Overnight Mode</span><b>{overnight ? lock ? "On · screen lock active" : "On · screen lock unavailable" : "Off"}</b></li><li><span>Phone volume</span><b>Check volume and silent mode</b></li></ul>
      {ios && !installed && <p className={styles.install}>On iOS 16.4 or later: open AXEN in Safari, tap Share → Add to Home Screen, then open the installed app and enable notifications.</p>}
      <Button className={styles.command} onClick={enablePush}>Enable backup notifications</Button>
      <Button className={styles.command} onClick={start}>Start Overnight Mode</Button>
      <Button className={styles.command} disabled={testing} onClick={runTest}>{testing ? "Test alarm scheduled…" : "Test alarm in 10 seconds"}</Button>
      <p className={styles.warning}>Browser alarms can't be guaranteed on every phone. Keep a backup alarm until your test works.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
    {overnight && <div className={styles.surface}><div className={styles.inner}><div className={styles.clock}>{now ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(now) : "—:—"}</div><p className={styles.muted}>Keep this screen open and plug in your phone</p><p className={styles.muted}>{lock ? "Screen Wake Lock active" : "Screen Wake Lock unavailable. Your screen may turn off."}</p><Button className={styles.command} onClick={async () => { await webAlarmScheduler.leaveOvernight(); setOvernight(false); onReady(false); }}>Leave Overnight Mode</Button></div></div>}
  </>;
}