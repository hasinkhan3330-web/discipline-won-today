import type { Database } from "@/integrations/supabase/types";

export type ContractRow = Database["public"]["Tables"]["daily_contracts"]["Row"];

export const CATEGORIES = ["study", "work", "workout", "meditation", "reading", "creative", "other"] as const;
export const PROOF_METHODS = [
  { id: "timer", label: "Timer" },
  { id: "timer_recall", label: "Timer + recall note" },
  { id: "checklist", label: "Checklist" },
  { id: "photo", label: "Photo" },
  { id: "zen_session", label: "Zen session" },
] as const;
export const REMINDER_PREFS = [
  { id: "none", label: "No reminder" },
  { id: "standard", label: "5 min before" },
  { id: "early", label: "15 min before" },
] as const;

export type ContractForm = {
  goal_id: string | null;
  title: string;
  category: string;
  local: string; // yyyy-MM-ddTHH:mm in the device timezone
  planned_min: number;
  rescue_min: number;
  trigger_text: string;
  proof_method: string;
  difficulty: number;
  reminder_pref: string;
  private_note: string;
};

/** Deterministic suggestion templates — editable, never touch the linked goal. */
export const TEMPLATES: Record<string, { title: string; planned: number; proof: string }> = {
  study: { title: "Study one chapter with notes", planned: 45, proof: "timer_recall" },
  work: { title: "Ship one focused work block", planned: 60, proof: "timer" },
  workout: { title: "Complete a 30-minute workout", planned: 30, proof: "checklist" },
  meditation: { title: "Meditate for 10 minutes", planned: 10, proof: "zen_session" },
  reading: { title: "Read 20 pages", planned: 30, proof: "timer_recall" },
  creative: { title: "Create for 30 focused minutes", planned: 30, proof: "timer" },
  other: { title: "Finish one important task", planned: 30, proof: "checklist" },
};

export function deviceTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

const pad = (n: number) => String(n).padStart(2, "0");
export function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function defaultStart(): string {
  const d = new Date(Date.now() + 30 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return toLocalInput(d);
}

export function emptyForm(): ContractForm {
  return {
    goal_id: null, title: "", category: "study", local: defaultStart(), planned_min: 45, rescue_min: 10,
    trigger_text: "", proof_method: "timer_recall", difficulty: 2, reminder_pref: "standard", private_note: "",
  };
}

export function formFromRow(r: ContractRow): ContractForm {
  return {
    goal_id: r.goal_id, title: r.title, category: r.category, local: toLocalInput(new Date(r.scheduled_at)),
    planned_min: Math.round(r.planned_seconds / 60), rescue_min: Math.round(r.rescue_seconds / 60),
    trigger_text: r.trigger_text ?? "", proof_method: r.proof_method, difficulty: r.difficulty,
    reminder_pref: r.reminder_pref, private_note: r.private_note ?? "",
  };
}

export const rescueMax = (planned: number) => Math.max(1, Math.min(60, planned - 1));

export function validate(f: ContractForm): Record<string, string> {
  const e: Record<string, string> = {};
  const t = f.title.trim();
  if (t.length < 3 || t.length > 120) e.title = "Use 3–120 characters.";
  if (!CATEGORIES.includes(f.category as any)) e.category = "Pick a category.";
  const when = new Date(f.local);
  if (isNaN(when.getTime())) e.local = "Pick a date and time.";
  else if (when.getTime() < Date.now() - 60_000) e.local = "Pick a time in the future.";
  if (!Number.isInteger(f.planned_min) || f.planned_min < 5 || f.planned_min > 240) e.planned_min = "5–240 minutes.";
  if (!Number.isInteger(f.rescue_min) || f.rescue_min < 1 || f.rescue_min > rescueMax(f.planned_min)) e.rescue_min = `1–${rescueMax(f.planned_min)} minutes.`;
  if (!PROOF_METHODS.some(p => p.id === f.proof_method)) e.proof_method = "Pick a proof method.";
  if (f.difficulty < 1 || f.difficulty > 3) e.difficulty = "1–3.";
  if (f.trigger_text.length > 200) e.trigger_text = "Max 200 characters.";
  if (f.private_note.length > 500) e.private_note = "Max 500 characters.";
  return e;
}

/** Only user-editable columns. Server derives local_day and checks ownership/timezone. */
export function toPayload(f: ContractForm, tz: string) {
  return {
    goal_id: f.goal_id, title: f.title.trim(), category: f.category,
    scheduled_at: new Date(f.local).toISOString(), timezone: tz,
    planned_seconds: f.planned_min * 60, rescue_seconds: f.rescue_min * 60,
    trigger_text: f.trigger_text.trim() || null, proof_method: f.proof_method,
    difficulty: f.difficulty, reminder_pref: f.reminder_pref,
    private_note: f.private_note.trim() || null, accountability_enabled: false,
  };
}

export function friendlyError(err: any): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "You're offline. Reconnect and try again.";
  const code = err?.code as string | undefined;
  const msg = String(err?.message ?? "");
  if (code === "23505" || /dc_one_primary_per_day/.test(msg)) return "You already have a contract for that day.";
  if (/scheduled_at in the past/.test(msg)) return "That time has already passed.";
  if (/invalid timezone/.test(msg)) return "Your device timezone isn't recognised.";
  if (/goal does not belong/.test(msg)) return "That goal isn't available.";
  if (code === "42501" || /JWT|permission|not owner|row-level/i.test(msg)) return "Your session expired or this action isn't allowed. Sign in again.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Connection problem. Try again.";
  return "Couldn't save. Try again.";
}

export function fmtWhen(r: ContractRow): string {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: r.timezone, weekday: "short", hour: "numeric", minute: "2-digit" })
      .format(new Date(r.scheduled_at));
  } catch { return new Date(r.scheduled_at).toLocaleString(); }
}
