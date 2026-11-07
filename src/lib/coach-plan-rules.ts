// Pure, browser-safe rules for Coach plans and profile confidence.
export const PLAN_LENGTHS = [1, 7, 21] as const;
export type PlanLength = (typeof PLAN_LENGTHS)[number];

export const REQUIRED_SLOTS = [
  "goal", "daily_time_available", "daily_schedule", "energy_peak",
  "distraction_trigger", "wake_time", "coach_style", "age_range",
] as const;

export type Slot = { value: unknown; confidence: number };
export type Slots = Record<string, Slot>;

export function profileConfidence(slots: Slots): number {
  const total = REQUIRED_SLOTS.reduce((sum, key) => sum + Math.max(0, Math.min(1, Number(slots[key]?.confidence ?? 0))), 0);
  return Math.round((total / REQUIRED_SLOTS.length) * 100);
}

/** Confidence gate applies only to the Build my plan button. */
export const PLAN_READY_CONFIDENCE = 70;
export function canBuildPlan(slots: Slots): boolean { return profileConfidence(slots) >= PLAN_READY_CONFIDENCE; }

export function lowestSlot(slots: Slots): string | null {
  let best: string | null = null; let low = 2;
  for (const key of REQUIRED_SLOTS) { const c = Number(slots[key]?.confidence ?? 0); if (c < low) { low = c; best = key; } }
  return low >= 0.9 ? null : best;
}

export type PlanTask = { title: string; minimum: string; trigger: string; time?: string; minutes: number; difficulty: "easy" | "medium" | "hard" };
export type PlanDay = { day: number; review?: boolean; tasks: PlanTask[] };
export type CoachPlan = { title: string; summary: string; days: PlanDay[] };

export function isPlanLength(n: unknown): n is PlanLength { return PLAN_LENGTHS.includes(n as PlanLength); }

export function maxTasksForDay(day: number): number { return day <= 7 ? 3 : 4; }

/** Deterministically enforce plan rules on whatever the model returned. */
export function enforcePlanRules(raw: any, length: PlanLength, dailyMinutes: number): CoachPlan {
  const budget = Math.max(5, Math.min(600, Math.round(Number(dailyMinutes) || 30)));
  const inDays: any[] = Array.isArray(raw?.days) ? raw.days : [];
  const days: PlanDay[] = [];
  for (let d = 1; d <= length; d++) {
    const src = inDays.find((x) => Number(x?.day) === d) ?? inDays[d - 1] ?? { tasks: [] };
    const tasks: PlanTask[] = [];
    let used = 0;
    for (const t of Array.isArray(src.tasks) ? src.tasks : []) {
      if (tasks.length >= maxTasksForDay(d)) break;
      const title = String(t?.title ?? "").trim().slice(0, 70);
      if (!title) continue;
      const minutes = Math.max(1, Math.min(240, Math.round(Number(t?.minutes) || 10)));
      if (used + minutes > budget) continue;
      const difficulty = ["easy", "medium", "hard"].includes(t?.difficulty) ? t.difficulty : "easy";
      const minimum = String(t?.minimum ?? "").trim().slice(0, 80) || "2-minute version";
      tasks.push({ title, minimum, trigger: String(t?.trigger ?? "").trim().slice(0, 80) || "After waking up", time: t?.time ? String(t.time).slice(0, 10) : undefined, minutes, difficulty });
      used += minutes;
    }
    days.push({ day: d, review: d % 7 === 0, tasks });
  }
  return { title: String(raw?.title ?? "Your AXEN plan").slice(0, 80), summary: String(raw?.summary ?? "").slice(0, 400), days };
}

/** Today's calendar date (YYYY-MM-DD) in an IANA timezone; falls back to UTC. */
export function localDay(timezone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch { return now.toISOString().slice(0, 10); }
}

export function isValidTimezone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** 0-based plan day index for localToday, or null when outside the plan. */
export function dayIndex(startDate: string, localToday: string, length: number): number | null {
  const diff = Math.round((Date.parse(localToday + "T00:00:00Z") - Date.parse(startDate + "T00:00:00Z")) / 86400000);
  return diff >= 0 && diff < length ? diff : null;
}

export function taskName(t: PlanTask): string {
  return `${t.title} (min: ${t.minimum})`.slice(0, 80);
}
