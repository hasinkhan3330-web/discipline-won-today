/**
 * Offline wake stop: the phone makes its own multi-step math questions (no server answer key ever reaches the
 * device). Solving 3 in a row stops the ring; coins come only from the server's claim check. Mirrored in
 * android-shell/offline-core.js for the offline fallback page (parity is unit-tested).
 */
export const OFFLINE_STREAK = 3;
export type OfflineQuestion = { text: string; answer: number };
export type WakeClaim = { alarmId: string; scheduledFor: string; solvedAt: string; elapsedMs: number };

export function makeOfflineQuestion(rand: () => number = Math.random): OfflineQuestion {
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const a = int(6, 19), b = int(3, 9), c = int(11, 99), d = int(11, 99);
  if (rand() < 0.5) return { text: `(${a} × ${b}) + ${c} − ${d}`, answer: a * b + c - d };
  return { text: `(${c} + ${d}) − ${a} × ${b}`, answer: c + d - a * b };
}
export function checkOfflineAnswer(q: OfflineQuestion, input: string) {
  const v = input.trim().replace(/^−/, "-");
  return /^-?\d+$/.test(v) && Number(v) === q.answer;
}
/** Correct answers in a row; any wrong answer resets to 0 (a new question is shown). */
export function nextStreak(streak: number, correct: boolean) { return correct ? streak + 1 : 0; }

/** The claim never carries a coin amount; the server computes it. */
export function buildClaim(alarmId: string, firingAt: number, solvedAt: number): WakeClaim {
  return { alarmId, scheduledFor: new Date(firingAt).toISOString(), solvedAt: new Date(solvedAt).toISOString(), elapsedMs: Math.max(0, solvedAt - firingAt) };
}
/** One claim per firing; a second solve of the same firing keeps the first claim. */
export function addClaim(queue: WakeClaim[], claim: WakeClaim) {
  return queue.some(c => c.alarmId === claim.alarmId && c.scheduledFor === claim.scheduledFor) ? queue : [...queue, claim];
}
export function removeClaim(queue: WakeClaim[], claim: WakeClaim) {
  return queue.filter(c => !(c.alarmId === claim.alarmId && c.scheduledFor === claim.scheduledFor));
}
