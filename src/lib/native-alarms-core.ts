/** Pure scheduling rules for native Android wake alarms (no Capacitor imports; unit-tested). */
export const ALARM_CHANNEL_ID = "alarms";
export const ALARM_SOUND = "axen_alarm.wav";
export const ALARM_ID_BASE = 1_000_000;
export const ALARM_SLOTS = 4320; // minutes in 3 days: firings within that span never share IDs
export const PER_FIRING = 31; // 1 main + 30 follow-ups
export const FOLLOW_UPS = 30;
export const FOLLOW_UP_GAP_MS = 60_000;
export const MAX_SCHEDULED = 450;
export const OFFLINE_WINDOW_MS = 35 * 60_000;
export const ALARM_TAP_KIND = "axen-alarm";

export type AlarmEntry = { id: number; at: number; firingAt: number; index: number; alarmId: string };
export type FiringInput = { alarmId: string; enabled: boolean; repeatDaily: boolean; nextFireAt: string | null; ringing?: { scheduledFor: string } | null };

export function isAlarmNotificationId(id: number) { return id >= ALARM_ID_BASE && id < ALARM_ID_BASE + ALARM_SLOTS * PER_FIRING; }
export function firingSlot(firingAt: number) { return ((Math.floor(firingAt / 60_000) % ALARM_SLOTS) + ALARM_SLOTS) % ALARM_SLOTS; }
export function notificationId(firingAt: number, index: number) { return ALARM_ID_BASE + firingSlot(firingAt) * PER_FIRING + index; }
/** Every ID (main + follow-ups) belonging to exactly one firing. */
export function firingIds(firingAt: number) { return Array.from({ length: PER_FIRING }, (_, i) => notificationId(firingAt, i)); }

/** Same wall-clock time on the next calendar day in the device's zone (DST-safe). */
export function nextDaySameTime(at: number) { const d = new Date(at); d.setDate(d.getDate() + 1); return d.getTime(); }

/** Upcoming firings: a still-ringing unsolved firing, then the next 2 (repeat) or 1 (one-time) firings. */
export function upcomingFirings(input: FiringInput, now: number, solved: ReadonlySet<number> = new Set()) {
  const out: number[] = [];
  if (input.ringing) {
    const r = Date.parse(input.ringing.scheduledFor);
    if (Number.isFinite(r) && now - r <= OFFLINE_WINDOW_MS) out.push(r);
  }
  if (input.enabled && input.nextFireAt) {
    const first = Date.parse(input.nextFireAt);
    if (Number.isFinite(first)) { out.push(first); if (input.repeatDaily) out.push(nextDaySameTime(first)); }
  }
  return [...new Set(out)].filter(f => !solved.has(f)).sort((a, b) => a - b);
}

/** Main + 30 one-minute follow-ups per firing, future only, nearest first, capped. */
export function buildSchedule(alarmId: string, firings: number[], now: number, cap = MAX_SCHEDULED): AlarmEntry[] {
  const all: AlarmEntry[] = [];
  for (const firingAt of firings) for (let index = 0; index <= FOLLOW_UPS; index++) {
    const at = firingAt + index * FOLLOW_UP_GAP_MS;
    if (at > now) all.push({ id: notificationId(firingAt, index), at, firingAt, index, alarmId });
  }
  return all.sort((a, b) => a.at - b.at || a.id - b.id).slice(0, Math.max(0, cap));
}

/** The firing a tapped notification belongs to, or null for any other notification. */
export function parseAlarmTap(extra: unknown): { alarmId: string; firingAt: number } | null {
  if (!extra || typeof extra !== "object") return null;
  const x = extra as Record<string, unknown>;
  if (x["kind"] !== ALARM_TAP_KIND || typeof x["alarmId"] !== "string" || typeof x["firingAt"] !== "number") return null;
  return { alarmId: x["alarmId"], firingAt: x["firingAt"] };
}

/** The firing the offline screen should stop: tapped one first, else a cached firing that rang in the last 35 min. */
export function activeOfflineFiring(firings: number[], tapped: number | null, now: number, solved: ReadonlySet<number>) {
  const ok = (f: number) => f <= now && now - f <= OFFLINE_WINDOW_MS && !solved.has(f);
  if (tapped !== null && ok(tapped)) return tapped;
  return firings.filter(ok).sort((a, b) => b - a)[0] ?? null;
}
