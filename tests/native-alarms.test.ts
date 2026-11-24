import { expect, test } from "bun:test";
import {
  ALARM_ID_BASE, MAX_SCHEDULED, PER_FIRING, activeOfflineFiring, buildSchedule, firingIds, isAlarmNotificationId,
  nextDaySameTime, notificationId, parseAlarmTap, pastWakeCutoff, upcomingFirings, wakeCutoffAt,
} from "../src/lib/native-alarms-core";
import { addClaim, buildClaim, checkOfflineAnswer, makeOfflineQuestion, nextStreak, removeClaim, OFFLINE_STREAK } from "../src/lib/wake-offline-core";
// @ts-expect-error plain JS mirror used by the offline fallback page
import * as shell from "../android-shell/offline-core.js";

const A = "11111111-1111-4111-8111-111111111111";
const now = Date.parse("2026-11-20T10:00:00Z");
const next = "2026-11-21T00:30:00Z"; // 06:00 IST
// Morning base in device-local time, so fixtures sit inside the 04:00–07:30 wake window.
const morning = new Date(2026, 10, 24, 6, 40).getTime();

test("repeat alarm schedules the next 2 firings, each with a main + 30 one-minute follow-ups", () => {
  const f = upcomingFirings({ alarmId: A, enabled: true, repeatDaily: true, nextFireAt: next }, now);
  expect(f).toEqual([Date.parse(next), nextDaySameTime(Date.parse(next))]);
  const s = buildSchedule(A, f, now);
  expect(s.length).toBe(62);
  const first = s.filter(e => e.firingAt === f[0]);
  expect(first.map(e => e.at - f[0]!)).toEqual(Array.from({ length: 31 }, (_, i) => i * 60_000));
});

test("one-time alarm schedules one firing; disabled alarm schedules nothing", () => {
  expect(upcomingFirings({ alarmId: A, enabled: true, repeatDaily: false, nextFireAt: next }, now)).toEqual([Date.parse(next)]);
  expect(upcomingFirings({ alarmId: A, enabled: false, repeatDaily: true, nextFireAt: next }, now)).toEqual([]);
});

test("IDs are stable, distinct across firings, and outside the reminder range", () => {
  const f1 = Date.parse(next), f2 = nextDaySameTime(f1);
  expect(notificationId(f1, 0)).toBe(notificationId(f1, 0));
  const ids1 = new Set(firingIds(f1)), ids2 = firingIds(f2);
  expect(ids1.size).toBe(PER_FIRING);
  expect(ids2.some(id => ids1.has(id))).toBe(false);
  for (const id of [...ids1, ...ids2]) { expect(isAlarmNotificationId(id)).toBe(true); expect(id).toBeGreaterThanOrEqual(ALARM_ID_BASE); }
  expect(isAlarmNotificationId(5000 + 99_999)).toBe(false);
});

test("solving one firing removes only that firing's chain; the next firing keeps its full chain", () => {
  const f1 = Date.parse(next), f2 = nextDaySameTime(f1);
  const after = buildSchedule(A, upcomingFirings({ alarmId: A, enabled: true, repeatDaily: true, nextFireAt: next }, now, new Set([f1])), now);
  expect(after.every(e => e.firingAt === f2)).toBe(true);
  expect(after.length).toBe(31);
  const cancelled = new Set(firingIds(f1));
  expect(after.some(e => cancelled.has(e.id))).toBe(false);
});

test("a still-ringing firing keeps only its remaining follow-ups after resync", () => {
  const ringAt = morning - 10 * 60_000;
  const f = upcomingFirings({ alarmId: A, enabled: true, repeatDaily: true, nextFireAt: new Date(nextDaySameTime(morning)).toISOString(), ringing: { scheduledFor: new Date(ringAt).toISOString() } }, morning);
  expect(f[0]).toBe(ringAt);
  const s = buildSchedule(A, f, morning).filter(e => e.firingAt === ringAt);
  expect(s.length).toBe(20); // follow-ups 11..30 remain
});

test("total scheduled notifications are capped at 450, nearest firings first", () => {
  const base = new Date(2026, 10, 24, 4, 0).getTime();
  const firings = Array.from({ length: 19 }, (_, i) => base + i * 5 * 60_000); // 04:00–05:30, all before cutoff
  const s = buildSchedule(A, firings, base - 1);
  expect(s.length).toBe(MAX_SCHEDULED);
  expect(Math.max(...s.map(e => e.firingAt))).toBeLessThan(firings[18]!);
  expect(s.every((e, i) => i === 0 || e.at >= s[i - 1]!.at)).toBe(true);
});

test("tap payload opens the alarm only for AXEN alarm notifications", () => {
  expect(parseAlarmTap({ kind: "axen-alarm", alarmId: A, firingAt: 5 })).toEqual({ alarmId: A, firingAt: 5 });
  expect(parseAlarmTap({ contractId: "x" })).toBeNull();
  expect(parseAlarmTap(undefined)).toBeNull();
});

test("offline firing: tapped one within 35 min wins; old or solved firings are ignored", () => {
  const r = morning - 5 * 60_000;
  expect(activeOfflineFiring([r], null, morning, new Set())).toBe(r);
  expect(activeOfflineFiring([morning - 40 * 60_000], null, morning, new Set())).toBeNull();
  expect(activeOfflineFiring([r], null, morning, new Set([r]))).toBeNull();
});

test("offline puzzle: multi-step, checked locally, 3 in a row, wrong answer resets", () => {
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 50; i++) {
    const q = makeOfflineQuestion(rand);
    expect(q.text).toMatch(/[×].*[+−]|[+−].*[×]/);
    expect(checkOfflineAnswer(q, String(q.answer))).toBe(true);
    expect(checkOfflineAnswer(q, String(q.answer + 1))).toBe(false);
  }
  let s = 0; s = nextStreak(s, true); s = nextStreak(s, true); s = nextStreak(s, false);
  expect(s).toBe(0);
  for (let i = 0; i < OFFLINE_STREAK; i++) s = nextStreak(s, true);
  expect(s).toBe(OFFLINE_STREAK);
});

test("claim carries no coin amount and is unique per firing", () => {
  const c = buildClaim(A, now - 300_000, now);
  expect(Object.keys(c).sort()).toEqual(["alarmId", "elapsedMs", "scheduledFor", "solvedAt"]);
  expect(c.elapsedMs).toBe(300_000);
  const q = addClaim(addClaim([], c), { ...c, solvedAt: new Date(now + 1).toISOString() });
  expect(q).toEqual([c]);
  expect(removeClaim(q, c)).toEqual([]);
});

test("offline fallback page mirrors the app rules exactly", () => {
  let s1 = 3, s2 = 3; const r1 = () => (s1 = (s1 * 16807) % 2147483647) / 2147483647, r2 = () => (s2 = (s2 * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 20; i++) expect(shell.makeOfflineQuestion(r1)).toEqual(makeOfflineQuestion(r2));
  const f = Date.parse(next);
  expect(shell.firingIds(f)).toEqual(firingIds(f));
  expect(shell.buildClaim(A, f, f + 1000)).toEqual(buildClaim(A, f, f + 1000));
  for (const t of [now, morning, new Date(2026, 10, 24, 7, 30).getTime()]) expect(shell.activeOfflineFiring([t - 60_000], null, t, new Set())).toBe(activeOfflineFiring([t - 60_000], null, t, new Set()));
});

// 07:30 local cutoff (device timezone)
const local = (h: number, m: number, s = 0) => new Date(2026, 10, 24, h, m, s).getTime();
test("cutoff is 07:30:00 local on the firing's own day", () => {
  expect(wakeCutoffAt(local(7, 20))).toBe(local(7, 30));
  expect(pastWakeCutoff(local(7, 20), local(7, 29, 59))).toBe(false);
  expect(pastWakeCutoff(local(7, 20), local(7, 30, 0))).toBe(true);
});
test("07:20 alarm follow-ups stop at 07:29; nothing at/after 07:30", () => {
  const e = buildSchedule(A, [local(7, 20)], local(7, 0));
  expect(e.length).toBe(10);
  expect(Math.max(...e.map(x => x.at))).toBe(local(7, 29));
  expect(buildSchedule(A, [local(7, 20)], local(7, 29, 59)).length).toBe(0);
});
test("07:45 alarm never schedules; repeat-daily next day before 07:30 still does", () => {
  expect(buildSchedule(A, [local(7, 45)], local(7, 0)).length).toBe(0);
  const tomorrow = nextDaySameTime(local(6, 0));
  expect(buildSchedule(A, [tomorrow], local(9, 0)).length).toBe(31);
});
test("offline stop screen ignores firings past cutoff", () => {
  expect(activeOfflineFiring([local(7, 20)], null, local(7, 29, 59), new Set())).toBe(local(7, 20));
  expect(activeOfflineFiring([local(7, 20)], null, local(7, 30), new Set())).toBe(null);
});
