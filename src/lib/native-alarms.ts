/**
 * Native Android wake alarms via @capacitor/local-notifications. Every function is a no-op unless
 * Capacitor.getPlatform() === "android" (iOS can be added later behind the same check).
 * Coins are never decided here; the server stays the only reward authority.
 */
import type { AlarmState } from "./wake-types";
import {
  ALARM_CHANNEL_ID, ALARM_SOUND, ALARM_TAP_KIND, buildSchedule, firingIds, isAlarmNotificationId, parseAlarmTap, upcomingFirings,
} from "./native-alarms-core";

const K_FIRINGS = "axen.alarm.firings"; // { alarmId, firings: number[] } cached for offline use
const K_SOLVED = "axen.alarm.solved"; // number[] firing times already solved (online or offline)
const K_TAPPED = "axen.alarm.tapped"; // number firing time of the last tapped alarm notification
const K_APP_URL = "axen.app.url";

async function platform() {
  if (typeof window === "undefined") return null;
  try { const { Capacitor } = await import("@capacitor/core"); return Capacitor.getPlatform() === "android" ? Capacitor : null; } catch { return null; }
}
export async function isAndroidNative() { return (await platform()) !== null; }
async function notifications() {
  const cap = await platform();
  if (!cap || !cap.isPluginAvailable("LocalNotifications")) return null;
  return (await import("@capacitor/local-notifications")).LocalNotifications;
}
export async function prefGet<T>(key: string, fallback: T): Promise<T> {
  try { const { Preferences } = await import("@capacitor/preferences"); const { value } = await Preferences.get({ key }); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
export async function prefSet(key: string, value: unknown) {
  try { const { Preferences } = await import("@capacitor/preferences"); await Preferences.set({ key, value: JSON.stringify(value) }); } catch { /* best effort */ }
}

export async function solvedFirings() {
  const cutoff = Date.now() - 3 * 864e5;
  return new Set((await prefGet<number[]>(K_SOLVED, [])).filter(f => f > cutoff));
}
export async function cachedFirings() { return prefGet<{ alarmId: string; firings: number[] } | null>(K_FIRINGS, null); }
export async function tappedFiring() { return prefGet<number | null>(K_TAPPED, null); }

let channelReady = false;
async function ensureChannel(ln: NonNullable<Awaited<ReturnType<typeof notifications>>>) {
  if (channelReady) return;
  await ln.createChannel({ id: ALARM_CHANNEL_ID, name: "Alarms", description: "AXEN wake alarms", importance: 5, visibility: 1, vibration: true, sound: ALARM_SOUND, lights: true });
  channelReady = true;
}

/** Ask for notification + exact-alarm permission (called after the user saves/enables an alarm). */
export async function ensureAlarmPermissions(explainExact: (open: () => void) => void) {
  const ln = await notifications();
  if (!ln) return;
  const p = await ln.requestPermissions();
  if (p.display !== "granted") return;
  try {
    const exact = await ln.checkExactNotificationSetting();
    if (exact.exact_alarm !== "granted") explainExact(() => { void ln.changeExactNotificationSetting(); });
  } catch { /* older Android: exact alarms allowed by default */ }
}

/** Cancel every AXEN alarm notification and schedule the current set again from server state. */
export async function syncNativeAlarms(state: AlarmState) {
  const ln = await notifications();
  if (!ln) return;
  try {
    await prefSet(K_APP_URL, window.location.origin);
    const solved = await solvedFirings();
    await prefSet(K_SOLVED, [...solved]);
    const s = state.settings;
    const ringing = state.event && state.event.status === "ringing" && !state.event.is_test ? { scheduledFor: state.event.scheduled_for } : null;
    const firings = s ? upcomingFirings({ alarmId: s.alarm_id, enabled: s.enabled, repeatDaily: s.repeat_daily, nextFireAt: s.next_fire_at, ringing }, Date.now(), solved) : [];
    await prefSet(K_FIRINGS, s ? { alarmId: s.alarm_id, firings } : null);
    const pending = await ln.getPending();
    const ours = pending.notifications.filter(n => isAlarmNotificationId(n.id)).map(n => ({ id: n.id }));
    if (ours.length) await ln.cancel({ notifications: ours });
    if (!s || !firings.length) return;
    const perm = await ln.checkPermissions();
    if (perm.display !== "granted") return;
    await ensureChannel(ln);
    const entries = buildSchedule(s.alarm_id, firings, Date.now());
    if (!entries.length) return;
    await ln.schedule({ notifications: entries.map(e => ({
      id: e.id, title: "AXEN · WAKE UP", body: e.index === 0 ? "Solve the challenge to stop the alarm." : "Still ringing. Solve the challenge to stop it.",
      channelId: ALARM_CHANNEL_ID, sound: ALARM_SOUND, autoCancel: true,
      schedule: { at: new Date(e.at), allowWhileIdle: true },
      extra: { kind: ALARM_TAP_KIND, alarmId: e.alarmId, firingAt: e.firingAt },
    })) });
  } catch { /* alarm page keeps the in-app ring as fallback */ }
}

/** Cancel ONLY this firing's main + follow-up notifications and remember it as solved. */
export async function markFiringSolved(firingAt: number) {
  const solved = await solvedFirings();
  solved.add(firingAt);
  await prefSet(K_SOLVED, [...solved]);
  const ln = await notifications();
  if (!ln) return;
  const ids = new Set(firingIds(firingAt));
  try {
    await ln.cancel({ notifications: [...ids].map(id => ({ id })) });
    const delivered = await ln.getDeliveredNotifications();
    const mine = delivered.notifications.filter(n => ids.has(n.id));
    if (mine.length) await ln.removeDeliveredNotifications({ notifications: mine });
  } catch { /* best effort */ }
}

/** Tapping an alarm notification (also on cold start: the plugin retains the launch tap) opens the alarm screen. */
export async function listenAlarmTaps(open: () => void) {
  const ln = await notifications();
  if (!ln) return () => {};
  const handle = await ln.addListener("localNotificationActionPerformed", event => {
    const tap = parseAlarmTap(event.notification.extra);
    if (!tap) return;
    void prefSet(K_TAPPED, tap.firingAt).then(open);
  });
  return () => { void handle.remove(); };
}

let hapticTimer: number | null = null;
/** Continuous vibration while the alarm screen rings; stopped only by a verified (or offline) solve. */
export async function startAlarmHaptics() {
  if (hapticTimer !== null || !(await platform())) return;
  const { Haptics } = await import("@capacitor/haptics");
  const buzz = () => { void Haptics.vibrate({ duration: 900 }).catch(() => {}); };
  buzz(); hapticTimer = window.setInterval(buzz, 1300);
}
export function stopAlarmHaptics() { if (hapticTimer !== null) window.clearInterval(hapticTimer); hapticTimer = null; }
