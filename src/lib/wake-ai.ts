/**
 * On-device wake detector.
 * Scores how likely it is that the person answering the alarm challenge is
 * genuinely awake — from reaction latency, typing cadence stability,
 * correction count and the real device clock hour.
 * Everything runs locally, no data leaves the phone.
 */

export type WakeSignals = {
  /** ms between the challenge appearing and the first keystroke */
  firstKeyMs: number;
  /** ms between challenge appearing and submit */
  totalMs: number;
  /** timestamps (ms) of each keystroke */
  keyGaps: number[];
  /** backspaces / rewrites */
  corrections: number;
  /** answer was correct */
  correct: boolean;
  /** wake tier the user claimed, e.g. "4AM" */
  claimed: string;
  /** device local hour at submit */
  hour: number;
};

export type WakeVerdict = {
  score: number;              // 0-100 confidence
  awake: boolean;             // score >= 60
  factors: { label: string; value: string; ok: boolean }[];
};

const clamp = (n: number, a = 0, b = 100) => Math.max(a, Math.min(b, n));

export function analyzeWake(s: WakeSignals): WakeVerdict {
  const factors: WakeVerdict["factors"] = [];
  let score = 0;

  // 1) correctness — the hard gate (45 pts)
  score += s.correct ? 45 : 0;
  factors.push({ label: "COGNITIVE CHECK", value: s.correct ? "PASSED" : "FAILED", ok: s.correct });

  // 2) reaction latency (20 pts) — awake brains start within ~12s
  const reactPts = s.firstKeyMs <= 12000 ? 20 : s.firstKeyMs <= 25000 ? 12 : 5;
  score += reactPts;
  factors.push({
    label: "REACTION LATENCY",
    value: `${(s.firstKeyMs / 1000).toFixed(1)}s`,
    ok: reactPts >= 12,
  });

  // 3) typing cadence stability (15 pts)
  const gaps = s.keyGaps.filter(g => g > 0 && g < 8000);
  const mean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const variance = gaps.length
    ? gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length
    : 0;
  const jitter = mean ? Math.sqrt(variance) / mean : 1;
  const cadencePts = jitter < 0.9 ? 15 : jitter < 1.6 ? 9 : 4;
  score += cadencePts;
  factors.push({
    label: "MOTOR STABILITY",
    value: gaps.length ? `${Math.round((1 - Math.min(jitter, 1)) * 100)}%` : "—",
    ok: cadencePts >= 9,
  });

  // 4) corrections (10 pts)
  const corrPts = s.corrections <= 1 ? 10 : s.corrections <= 4 ? 6 : 2;
  score += corrPts;
  factors.push({ label: "INPUT NOISE", value: `${s.corrections} fix`, ok: corrPts >= 6 });

  // 5) clock plausibility (10 pts) — 3AM–9AM window is a genuine wake window
  const inWindow = s.hour >= 3 && s.hour <= 9;
  score += inWindow ? 10 : 4;
  factors.push({
    label: "CLOCK WINDOW",
    value: `${String(s.hour).padStart(2, "0")}:00 local`,
    ok: inWindow,
  });

  // sluggish overall completion drags the score
  if (s.totalMs > 60000) score -= 8;

  score = clamp(Math.round(score));
  return { score, awake: s.correct && score >= 60, factors };
}
