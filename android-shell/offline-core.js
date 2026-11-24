// Mirror of src/lib/wake-offline-core.ts + src/lib/native-alarms-core.ts ID/firing rules (parity unit-tested).
export const OFFLINE_STREAK = 3;
export const OFFLINE_WINDOW_MS = 35 * 60000;
const BASE = 1000000, SLOTS = 4320, PER = 31;
export function makeOfflineQuestion(rand = Math.random) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const a = int(6, 19), b = int(3, 9), c = int(11, 99), d = int(11, 99);
  if (rand() < 0.5) return { text: `(${a} × ${b}) + ${c} − ${d}`, answer: a * b + c - d };
  return { text: `(${c} + ${d}) − ${a} × ${b}`, answer: c + d - a * b };
}
export function checkOfflineAnswer(q, input) { const v = String(input).trim().replace(/^−/, "-"); return /^-?\d+$/.test(v) && Number(v) === q.answer; }
export function nextStreak(streak, correct) { return correct ? streak + 1 : 0; }
export function firingIds(firingAt) { const slot = ((Math.floor(firingAt / 60000) % SLOTS) + SLOTS) % SLOTS; return Array.from({ length: PER }, (_, i) => BASE + slot * PER + i); }
export function wakeCutoffAt(firingAt) { const d = new Date(firingAt); d.setHours(7, 30, 0, 0); return d.getTime(); }
export function activeOfflineFiring(firings, tapped, now, solved) {
  const ok = f => f <= now && now < wakeCutoffAt(f) && now - f <= OFFLINE_WINDOW_MS && !solved.has(f);
  if (tapped !== null && tapped !== undefined && ok(tapped)) return tapped;
  return firings.filter(ok).sort((a, b) => b - a)[0] ?? null;
}
export function buildClaim(alarmId, firingAt, solvedAt) { return { alarmId, scheduledFor: new Date(firingAt).toISOString(), solvedAt: new Date(solvedAt).toISOString(), elapsedMs: Math.max(0, solvedAt - firingAt) }; }
export function addClaim(queue, claim) { return queue.some(c => c.alarmId === claim.alarmId && c.scheduledFor === claim.scheduledFor) ? queue : [...queue, claim]; }
