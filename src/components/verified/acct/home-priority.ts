// Pure picker for the single top card on Accountability Home (display order only).
export type HomePriority = "missed" | "due" | "checkin" | "cheer" | "garden" | "empty";
export type PriorityInput = { missed: boolean; dueToday: boolean; checkinDue: boolean; partnerCheer: boolean; hasGarden: boolean };
export function pickHomePriority(i: PriorityInput): HomePriority {
  if (i.missed) return "missed";
  if (i.dueToday) return "due";
  if (i.checkinDue) return "checkin";
  if (i.partnerCheer) return "cheer";
  if (i.hasGarden) return "garden";
  return "empty";
}
export const MILESTONES = [3, 7, 14, 30] as const;
/** Show a milestone sheet only for a real milestone not yet remembered on this device. */
export function shouldShowMilestone(n: number | null | undefined, seen: (key: string) => boolean): boolean {
  return n != null && (MILESTONES as readonly number[]).includes(n) && !seen(`pair.${n}`);
}
/** Garden stage-up: only when a previously stored stage exists and the new one is higher. */
export function isStageUp(prev: number | null, cur: number): boolean { return prev != null && cur > prev; }
export function inviteLink(origin: string, code: string): string { return `${origin}/join/${encodeURIComponent(code)}`; }
export function firstName(name: string | null | undefined): string | null {
  const f = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return f && !f.includes("@") ? f.slice(0, 20) : null;
}
