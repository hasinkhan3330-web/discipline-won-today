import { useEffect, useState, type ReactNode } from "react";
import s from "./acct.module.css";

/** SVG progress ring: track = border colour, progress = ring colour, starts at 12 o'clock, animates on load. */
export function ARing({ size, stroke, value, children, label }: { size: number; stroke: number; value: number; children?: ReactNode; label?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(Math.max(0, Math.min(1, value)))); return () => cancelAnimationFrame(t); }, [value]);
  const r = (size - stroke) / 2, C = 2 * Math.PI * r;
  return (
    <div className={s.ringWrap} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--a-border)" strokeWidth={stroke} />
        <circle className={s.ringProg} cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--a-ring)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - shown)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className={s.ringCenter}>{children}</div>
    </div>
  );
}

export type DayState = "done" | "missed" | "today" | "future" | "none";
const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
export function WeekStrip({ days }: { days: { date: Date; state: DayState }[] }) {
  return (
    <div className={s.week} aria-label="This week">
      {days.map((d, i) => {
        const cls = d.state === "done" ? s.dDone : d.state === "missed" ? s.dMiss : d.state === "today" ? s.dToday : "";
        return (
          <div key={i} className={s.day}>
            <span className={s.dayL}>{LETTERS[i]}</span>
            <span className={`${s.dayC} ${cls}`} aria-label={`${d.date.toDateString()}: ${d.state}`}>{d.date.getDate()}</span>
          </div>
        );
      })}
    </div>
  );
}

export const STAGE_NAMES = ["Seed", "Sapling", "Young", "Lush", "Ancient"] as const;
/** One reusable tree, stages 1–5. Deeper green and fuller canopy at higher stages. */
export function Tree({ stage, width, height }: { stage: number; width: number; height?: number }) {
  const st = Math.max(1, Math.min(5, Math.round(stage)));
  const h = height ?? Math.round(width * 1.1);
  const trunk = "#7c5a3a";
  return (
    <svg width={width} height={h} viewBox="0 0 100 110" role="img" aria-label={`${STAGE_NAMES[st - 1]} tree`} style={{ flex: "none" }}>
      {st === 1 && <><rect x="47" y="64" width="6" height="42" rx="3" fill={trunk} /><ellipse cx="58" cy="62" rx="9" ry="5" fill="#a7f3d0" transform="rotate(-30 58 62)" /></>}
      {st === 2 && <><rect x="46" y="54" width="8" height="52" rx="4" fill={trunk} />
        <ellipse cx="60" cy="52" rx="12" ry="6" fill="#86efac" transform="rotate(-30 60 52)" /><ellipse cx="40" cy="58" rx="12" ry="6" fill="#86efac" transform="rotate(30 40 58)" /></>}
      {st === 3 && <><rect x="45" y="60" width="10" height="46" rx="5" fill={trunk} /><circle cx="50" cy="48" r="28" fill="#22c55e" stroke="#86efac" strokeWidth="2" /></>}
      {st === 4 && <><rect x="44" y="62" width="12" height="44" rx="6" fill={trunk} />
        <circle cx="32" cy="60" r="18" fill="#16a34a" stroke="#4ade80" strokeWidth="2" /><circle cx="68" cy="60" r="18" fill="#16a34a" stroke="#4ade80" strokeWidth="2" />
        <circle cx="50" cy="44" r="26" fill="#15803d" stroke="#4ade80" strokeWidth="2" /></>}
      {st === 5 && <><rect x="43" y="64" width="14" height="42" rx="7" fill={trunk} />
        <circle cx="28" cy="58" r="20" fill="#166534" stroke="#4ade80" strokeWidth="2" /><circle cx="72" cy="58" r="20" fill="#166534" stroke="#4ade80" strokeWidth="2" />
        <circle cx="50" cy="40" r="30" fill="#14532d" stroke="#4ade80" strokeWidth="2" /><circle cx="50" cy="62" r="18" fill="#15803d" stroke="#4ade80" strokeWidth="2" />
        <circle cx="40" cy="30" r="6" fill="#22c55e" /><circle cx="62" cy="44" r="5" fill="#22c55e" /><circle cx="30" cy="56" r="4" fill="#22c55e" /></>}
    </svg>
  );
}

export function SubHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className={s.sub}>
      <button className={s.iconBtn} onClick={onBack} aria-label="Back">←</button>
      <h3 className={s.subTitle} style={{ flex: 1 }}>{title}</h3>
      {right}
    </div>
  );
}

/** Pure helpers (tested). */
export function gardenStage(score: number): number {
  return score >= 80 ? 5 : score >= 60 ? 4 : score >= 40 ? 3 : score >= 20 ? 2 : 1;
}
export function weekDays(today: Date, byDay: Record<string, "done" | "missed" | "planned">): { date: Date; state: DayState }[] {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monday = new Date(t); monday.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const key = ymd(d);
    const v = byDay[key];
    let state: DayState = d > t ? "future" : "none";
    if (v === "done") state = "done";
    else if (v === "missed" && d < t) state = "missed";
    if (d.getTime() === t.getTime() && v !== "done") state = "today";
    return { date: d, state };
  });
}
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
