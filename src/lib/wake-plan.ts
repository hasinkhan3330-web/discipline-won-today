/**
 * Wake plan storage + scheduling helpers for the Wake-Up mission.
 * Everything is local to the device; no backend schema changes.
 */

export type WakePlan = {
  /** yyyy-mm-dd the plan was saved for */
  date: string;
  /** e.g. "4AM" */
  tier: string;
  /** coins awarded once verified */
  pts: number;
  /** tier tagline */
  line: string;
  /** ringtone id */
  tone: string;
  /** verification mode used to dismiss the alarm */
  mode: "math" | "science";
};

const KEY = "axen_wake_plan";
const FIRED = "axen_wake_fired";

/** Local calendar day key — the alarm hour is local, so the date must be too. */
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const todayKey = () => dayKey(new Date());

/** Calendar day of the NEXT occurrence of this tier hour (today if still ahead, else tomorrow). */
export function nextPlanDate(tier: string): string {
  const now = new Date();
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), tierHour(tier), 0, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return dayKey(at);
}

export function loadPlan(): WakePlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as WakePlan;
    return p && p.tier ? p : null;
  } catch { return null; }
}

export function savePlan(p: WakePlan) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function clearPlan() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** "4AM" -> 4 */
export function tierHour(tier: string): number {
  const n = parseInt(tier, 10);
  return Number.isFinite(n) ? n : 4;
}

/** Epoch ms of the alarm for the plan's own date. */
export function triggerAt(p: WakePlan): number {
  const [y, m, d] = p.date.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, tierHour(p.tier), 0, 0, 0);
  return dt.getTime();
}

/** Next upcoming alarm (rolls to tomorrow once today's time has passed). */
export function nextTrigger(p: WakePlan): number {
  const t = triggerAt(p);
  if (t > Date.now()) return t;
  return t + 24 * 60 * 60 * 1000;
}

export function rollPlanForward(p: WakePlan): WakePlan {
  return { ...p, date: nextPlanDate(p.tier) };
}

/** A plan whose alarm time is more than an hour past is missed, not due. */
const GRACE_MS = 60 * 60 * 1000;

/** True when the alarm time has arrived for this plan's date and it has not fired yet. */
export function shouldFire(p: WakePlan): boolean {
  if (p.date !== todayKey()) return false;
  if (alreadyFired(p)) return false;
  const at = triggerAt(p);
  return Date.now() >= at && Date.now() < at + GRACE_MS;
}

/** True when the plan's slot is in the past, so it must be re-armed for the next day. */
export function isStalePlan(p: WakePlan): boolean {
  return Date.now() >= triggerAt(p) + GRACE_MS;
}

export function alreadyFired(p: WakePlan): boolean {
  if (typeof window === "undefined") return true;
  try { return localStorage.getItem(FIRED) === `${p.date}:${p.tier}`; } catch { return false; }
}

export function markFired(p: WakePlan) {
  try { localStorage.setItem(FIRED, `${p.date}:${p.tier}`); } catch { /* ignore */ }
}

/** Best-effort native/local notification so the alarm surfaces when the app is backgrounded. */
export async function scheduleNativeAlarm(p: WakePlan) {
  if (typeof window === "undefined") return;
  const at = nextTrigger(p);
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications")) {
      const mod: any = await import(/* @vite-ignore */ "@capacitor/local-notifications").catch(() => null);
      const LN = mod?.LocalNotifications;
      if (LN) {
        await LN.requestPermissions();
        await LN.schedule({
          notifications: [{
            id: 4001,
            title: `${p.tier} WAKE PROTOCOL`,
            body: "Open AXEN and solve the challenge to stop the alarm.",
            schedule: { at: new Date(at), allowWhileIdle: true },
          }],
        });
        return;
      }
    }
  } catch { /* fall through to web */ }

  try {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch { /* ignore */ }
}

export async function cancelNativeAlarm() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("LocalNotifications")) return;
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({ notifications: [{ id: 4001 }] });
  } catch { /* best effort */ }
}

/** Re-arms a saved daily wake plan after verification or app resume. */
export async function rearmWakePlan(p: WakePlan) {
  const next = rollPlanForward(p);
  savePlan(next);
  await scheduleNativeAlarm(next);
  return next;
}
