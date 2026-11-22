/** Server limit on active Home tasks (defaults included) (enforced by the enforce_task_limit trigger). */
export const HOME_TASK_LIMIT = 5;

export function taskLimitMessage(err: { message?: string } | null | undefined): string | null {
  if (!err?.message || !/task limit reached/i.test(err.message)) return null;
  return `Home holds ${HOME_TASK_LIMIT} habits, including the defaults. Delete one to add a new habit.`;
}
