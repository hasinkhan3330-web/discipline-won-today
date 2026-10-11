/** Wake-only rules. Server migration mirrors these exact boundaries. */
export const WAKE_MAX_REWARDED_PER_DAY = 1;
export const WAKE_MIN_LEAD_SECONDS = 7200;
export const WAKE_SOLVE_WINDOW_SECONDS = 1800;
export const WAKE_PUSH_MAX_ROUNDS = 30;
export function wakeReward(time: string): number {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 4 || h > 7 || m < 0 || m > 59) return 0;
  return [10, 7, 5, 3][h - 4] ?? 0;
}
export function wakeEligibility(saved: number, firstRing: number, solved: number, time: string, test = false) {
  if (test) return "test_alarm";
  if (!wakeReward(time)) return "outside_reward_window";
  if (firstRing - saved < WAKE_MIN_LEAD_SECONDS * 1000) return "saved_too_late";
  if (solved - firstRing > WAKE_SOLVE_WINDOW_SECONDS * 1000) return "solve_too_late";
  return "eligible";
}
export const WAKE_REASONS: Record<string, string> = {
  test_alarm: "Test complete. No coins, XP or streak changes.",
  outside_reward_window: "Alarm solved. Coins are available only from 04:00 to 07:59.",
  saved_too_late: "Alarm solved. Save at least two hours before it rings to earn coins.",
  solve_too_late: "Alarm solved. The 30-minute reward window has passed.",
  daily_claimed: "Alarm solved. Today's wake reward was already claimed.",
  awarded: "Wake challenge complete.",
};

/** Used for independent timezone tests; database remains scheduling authority. */
export function nextWakeInstant(now: number, time: string, zone: string): number {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const local = (at: number) => {
    const p = Object.fromEntries(fmt.formatToParts(at).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
  };
  const today = local(now).slice(0, 10);
  const [h, m] = time.split(":").map(Number);
  if (h === undefined || m === undefined || h < 0 || h > 23 || m < 0 || m > 59) throw new Error("Invalid wake time");
  const base = Date.parse(`${today}T00:00:00Z`);
  for (let day = 0; day < 3; day++) {
    const date = new Date(base + day * 86400000).toISOString().slice(0, 10);
    const target = `${date} ${time}`;
    let first: number | undefined;
    let after: number | undefined;
    // Local calendar conversion is deliberately separate from device clock.
    for (let t = base + day * 86400000 - 14 * 3600000; t <= base + (day + 1) * 86400000 + 14 * 3600000; t += 60000) {
      const s = local(t);
      if (s === target && first === undefined) first = t;
      if (s.slice(0, 10) === date && s >= target && after === undefined) after = t;
    }
    const candidate = first ?? after;
    if (candidate !== undefined && candidate > now) return candidate;
  }
  throw new Error("Could not compute next occurrence");
}