import { expect, test } from "bun:test";
import {
  ALARM_ID_BASE, MAX_SCHEDULED, PER_FIRING, activeOfflineFiring, buildSchedule, firingIds, isAlarmNotificationId,
  nextDaySameTime, notificationId, parseAlarmTap, upcomingFirings,
} from "../src/lib/native-alarms-core";
import { addClaim, buildClaim, checkOfflineAnswer, makeOfflineQuestion, nextStreak, removeClaim, OFFLINE_STREAK } from "../src/lib/wake-offline-core";
// @ts-expect-error plain JS mirror used by the offline fallback page
import * as shell from "../android-shell/offline-core.js";

const A = "11111111-1111-4111-8111-111111111111";
const now = Date.parse("2026-11-20T10:00:00Z");
const next = "2026-11-21T00:30:00Z"; // 06:00 IST

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
  const ringAt = now - 10 * 60_000;
  const f = upcomingFirings({ alarmId: A, enabled: true, repeatDaily: true, nextFireAt: next, ringing: { scheduledFor: new Date(ringAt).toISOString() } }, now);
  expect(f[0]).toBe(ringAt);
  const s = buildSchedule(A, f, now).filter(e => e.firingAt === ringAt);
  expect(s.length).toBe(20); // follow-ups 11..30 remain
});

test("total scheduled notifications are capped at 450, nearest firings first", () => {
  const firings = Array.from({ length: 20 }, (_, i) => now + (i + 1) * 3_600_000);
  const s = buildSchedule(A, firings, now);
  expect(s.length).toBe(MAX_SCHEDULED);
  expect(Math.max(...s.map(e => e.firingAt))).toBeLessThan(Math.min(...firings.slice(15)));
  expect(s.every((e, i) => i === 0 || e.at >= s[i - 1]!.at)).toBe(true);
});

test("tap payload opens the alarm only for AXEN alarm notifications", () => {
  expect(parseAlarmTap({ kind: "axen-alarm", alarmId: A, firingAt: 5 })).toEqual({ alarmId: A, firingAt: 5 });
  expect(parseAlarmTap({ contractId: "x" })).toBeNull();
  expect(parseAlarmTap(undefined)).toBeNull();
});

test("offline firing: tapped one within 35 min wins; old or solved firings are ignored", () => {
  const r = now - 5 * 60_000;
  expect(activeOfflineFiring([r], null, now, new Set())).toBe(r);
  expect(activeOfflineFiring([now - 40 * 60_000], null, now, new Set())).toBeNull();
  expect(activeOfflineFiring([r], null, now, new Set([r]))).toBeNull();
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
  expect(shell.activeOfflineFiring([now - 60_000], null, now, new Set())).toBe(activeOfflineFiring([now - 60_000], null, now, new Set()));
});
