import { toLocalInput } from "@/lib/verified/contracts";

/** Pure helpers for the New pact pickers. All values stay in the old `datetime-local` string format (local time, "YYYY-MM-DDTHH:mm"). */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseLocal(v: string): Date { return new Date(v); }

export function to12(v: string): { h: number; m: number; ap: "AM" | "PM" } {
  const d = parseLocal(v); const H = d.getHours();
  return { h: H % 12 === 0 ? 12 : H % 12, m: d.getMinutes(), ap: H < 12 ? "AM" : "PM" };
}
export function from12(h: number, ap: "AM" | "PM"): number { return (h % 12) + (ap === "PM" ? 12 : 0); }

export function fmtTime(v: string): string {
  const d = parseLocal(v); if (isNaN(d.getTime())) return "—";
  const t = to12(v); return `${t.h}:${String(t.m).padStart(2, "0")} ${t.ap}`;
}
export function fmtLocal(v: string): string {
  const d = parseLocal(v); if (isNaN(d.getTime())) return "Pick a time";
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${fmtTime(v)}`;
}
/** Keep the calendar day of `v`, set a 12-hour clock time. */
export function setTime12(v: string, h: number, m: number, ap: "AM" | "PM"): string {
  const d = parseLocal(v); d.setHours(from12(h, ap), m, 0, 0); return toLocalInput(d);
}
/** Real elapsed minutes, so midnight and DST crossings land on the right day. */
export function addMinutesLocal(v: string, mins: number): string {
  return toLocalInput(new Date(parseLocal(v).getTime() + mins * 60_000));
}
/** Put `v`'s clock time on the day `offset` days after `base`'s day. */
export function onDayOf(base: string, v: string, offset: number): string {
  const b = parseLocal(base), d = parseLocal(v);
  const out = new Date(b.getFullYear(), b.getMonth(), b.getDate() + offset, d.getHours(), d.getMinutes(), 0, 0);
  return toLocalInput(out);
}
/** Whole days from `base`'s day to `v`'s day. */
export function dayOffset(base: string, v: string): number {
  const b = parseLocal(base), d = parseLocal(v);
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()) / 86_400_000);
}
