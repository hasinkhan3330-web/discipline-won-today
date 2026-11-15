// Pure, browser-safe validation for the coach's save_plan tool.
export type PlanTaskInput = { task_date: string; day_number?: number; title: string; description?: string; duration_minutes?: number };
export type ValidTask = { task_date: string; day_number: number | null; title: string; description: string | null; duration_minutes: number | null };
export const MAX_PLAN_DAYS = 7;
export const MAX_TASKS_PER_DAY = 4;

export function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** today = the user's local date (YYYY-MM-DD in their timezone). Allowed: today .. today+7. */
export function validatePlan(args: any, today: string):
  | { ok: true; plan_title: string; tasks: ValidTask[] }
  | { ok: false; error: string } {
  const title = String(args?.plan_title ?? "").trim().slice(0, 120) || "My plan";
  const raw = Array.isArray(args?.tasks) ? args.tasks : null;
  if (!raw || raw.length === 0) return { ok: false, error: "No tasks were given." };
  const last = addDays(today, MAX_PLAN_DAYS);
  const perDay = new Map<string, number>();
  const tasks: ValidTask[] = [];
  for (const t of raw) {
    const date = String(t?.task_date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + "T00:00:00Z")) || addDays(date, 0) !== date) return { ok: false, error: `Invalid date: ${date || "missing"}.` };
    if (date < today || date > last) return { ok: false, error: `Dates must be between ${today} and ${last}.` };
    const name = String(t?.title ?? "").trim();
    if (!name) return { ok: false, error: "Every task needs a title." };
    const count = (perDay.get(date) ?? 0) + 1;
    if (count > MAX_TASKS_PER_DAY) return { ok: false, error: `At most ${MAX_TASKS_PER_DAY} tasks per day.` };
    perDay.set(date, count);
    const mins = t?.duration_minutes == null || t.duration_minutes === "" ? null : Math.round(Number(t.duration_minutes));
    if (mins !== null && (!Number.isFinite(mins) || mins < 1 || mins > 480)) return { ok: false, error: "Duration must be 1-480 minutes." };
    const dn = t?.day_number == null ? null : Math.round(Number(t.day_number));
    tasks.push({ task_date: date, day_number: Number.isFinite(dn as number) ? dn : null, title: name.slice(0, 160), description: t?.description ? String(t.description).slice(0, 500) : null, duration_minutes: mins });
  }
  if (perDay.size > MAX_PLAN_DAYS) return { ok: false, error: `I plan ${MAX_PLAN_DAYS} days at a time.` };
  return { ok: true, plan_title: title, tasks };
}
