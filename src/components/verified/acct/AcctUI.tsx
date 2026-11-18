import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Lock } from "lucide-react";
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
export function WeekStrip({ days, selected, onSelect }: { days: { date: Date; state: DayState }[]; selected?: number | null; onSelect?: (i: number) => void }) {
  return (
    <div className={s.week} role="group" aria-label="This week">
      {days.map((d, i) => {
        const cls = d.state === "done" ? s.dDone : d.state === "missed" ? s.dMiss : d.state === "today" ? s.dToday : "";
        return (
          <button type="button" key={i} className={`${s.day} ${selected === i ? s.daySel : ""}`} onClick={() => onSelect?.(i)} aria-pressed={selected === i}
            aria-label={`${d.date.toDateString()}: ${d.state === "none" || d.state === "future" ? "no pacts" : d.state}`}>
            <span className={s.dayL}>{LETTERS[i]}</span>
            <span className={`${s.dayC} ${cls}`}><span className={s.dayDot} /></span>
            <span className={s.dayN}>{d.date.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SectionHead({ icon, title, sub, right }: { icon: ReactNode; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className={s.secHead}>
      <span className={s.iconTile} aria-hidden="true">{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}><div className={s.secTitle}>{title}</div>{sub && <div className={s.muted}>{sub}</div>}</div>
      {right}
    </div>
  );
}

export function Switch({ checked, onChange, disabled, label, help }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; help: string }) {
  return (
    <div className={s.switchRow}>
      <div style={{ minWidth: 0, flex: 1 }}><div className={s.switchLabel}>{label}</div><div className={s.muted}>{help}</div></div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`${s.switch} ${checked ? s.switchOn : ""}`} onClick={() => onChange(!checked)}><span /></button>
    </div>
  );
}

export const STAGE_NAMES = ["Seed", "Sapling", "Young", "Lush", "Ancient"] as const;
/** One reusable tree, stages 1–5: soil mound, gradients, gentle sway (off with reduced motion). */
export function Tree({ stage, width, height }: { stage: number; width: number; height?: number }) {
  const st = Math.max(1, Math.min(5, Math.round(stage)));
  const h = height ?? Math.round(width * 1.1);
  const id = `t${st}-${width}`;
  const leaf = (cx: number, cy: number, r: number, k = 0) => <circle key={`${cx}-${cy}-${k}`} cx={cx} cy={cy} r={r} fill={`url(#${id}c)`} />;
  return (
    <svg width={width} height={h} viewBox="0 0 100 110" role="img" aria-label={`${STAGE_NAMES[st - 1]} tree`} style={{ flex: "none", overflow: "visible" }}>
      <defs>
        <linearGradient id={`${id}t`} x1="0" x2="1"><stop offset="0" stopColor="#5b3d24" /><stop offset=".5" stopColor="#8a6340" /><stop offset="1" stopColor="#5b3d24" /></linearGradient>
        <radialGradient id={`${id}c`} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#bef264" /><stop offset=".55" stopColor="#4ade80" /><stop offset="1" stopColor="#15803d" /></radialGradient>
        <radialGradient id={`${id}s`} cx=".5" cy=".2" r=".9"><stop offset="0" stopColor="#7a5636" /><stop offset="1" stopColor="#3b2716" /></radialGradient>
      </defs>
      <ellipse cx="50" cy="104" rx={18 + st * 4} ry="6" fill={`url(#${id}s)`} />
      <g className={s.sway} style={{ transformOrigin: "50px 102px" }}>
        {st === 1 && <><path d="M50 102 C50 94 50 90 51 86" stroke="#6b8f3a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M51 88 C58 82 64 84 64 84 C60 91 54 91 51 88Z" fill={`url(#${id}c)`} /><path d="M50 91 C44 86 38 88 38 88 C42 94 47 94 50 91Z" fill={`url(#${id}c)`} />
          <ellipse cx="50" cy="101" rx="5" ry="3" fill="#8a6340" /></>}
        {st === 2 && <><path d="M50 102 C49 88 51 78 50 66" stroke={`url(#${id}t)`} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M50 76 C60 66 70 68 70 68 C66 78 57 80 50 76Z" fill={`url(#${id}c)`} /><path d="M50 84 C40 76 30 78 30 78 C34 88 43 88 50 84Z" fill={`url(#${id}c)`} />
          <path d="M50 68 C46 58 50 50 50 50 C56 58 54 64 50 68Z" fill={`url(#${id}c)`} /></>}
        {st === 3 && <><path d="M46 102 L47.5 66 L52.5 66 L54 102Z" fill={`url(#${id}t)`} />
          {[leaf(50, 52, 22), leaf(34, 62, 13), leaf(66, 62, 13)]}</>}
        {st === 4 && <><path d="M45 102 L47 64 L53 64 L55 102Z" fill={`url(#${id}t)`} /><path d="M50 78 L36 66" stroke={`url(#${id}t)`} strokeWidth="3" strokeLinecap="round" />
          {[leaf(30, 62, 16), leaf(70, 62, 16), leaf(50, 44, 24), leaf(40, 32, 12), leaf(62, 34, 12)]}</>}
        {st === 5 && <><path d="M43 102 Q46 82 46.5 62 L53.5 62 Q54 82 57 102Z" fill={`url(#${id}t)`} />
          <path d="M50 80 L32 64 M50 74 L70 60" stroke={`url(#${id}t)`} strokeWidth="3.5" strokeLinecap="round" />
          {[leaf(24, 60, 17), leaf(76, 58, 17), leaf(50, 40, 27), leaf(34, 30, 14), leaf(66, 30, 14), leaf(50, 18, 12), leaf(50, 62, 14)]}
          {[[38, 34], [62, 46], [28, 58], [70, 28]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.2" fill="#ecfccb" opacity=".85" />)}</>}
      </g>
    </svg>
  );
}

/** Rank-style stage scroller: reached, current (lime pill) and locked stages. */
export function StageRow({ stage, violet }: { stage: number; violet?: boolean }) {
  return (
    <div className={`${s.stageRow} ${violet ? s.stageViolet : ""}`} role="list" aria-label="Garden stages">
      {STAGE_NAMES.map((n, i) => { const k = i + 1, cur = k === stage, locked = k > stage;
        return <div key={n} role="listitem" className={`${s.stageItem} ${cur ? s.stageCur : ""} ${locked ? s.stageLocked : ""}`} aria-current={cur ? "step" : undefined}>
          <span className={s.stageArt}><Tree stage={k} width={34} />{locked && <span className={s.stageLock} aria-label="Locked"><Lock size={10} /></span>}</span>
          <b>{n}</b>{cur && <span className={s.stagePill}>Current</span>}
        </div>; })}
    </div>
  );
}

/** Same score rules as the server; display only. */
export function ScoreRules() {
  const rows: [string, number, string][] = [["Pacts done on time", 85, "85%"], ["Recovered pact counts", 60, "60%"], ["Check-in days", 15, "15%"]];
  return (
    <details className={s.rules}>
      <summary><span>How your score works</span><ChevronDown size={16} aria-hidden="true" /></summary>
      {rows.map(([l, w, v]) => <div key={l} className={s.ruleRow}><span>{l}</span><span className={s.ruleBar}><i style={{ width: `${w}%` }} /></span><b className={s.pillMono}>{v}</b></div>)}
      <div className={s.ruleRow}><span>Each overdue pact</span><span /><b className={`${s.pillMono} ${s.pillMonoCoral}`}>−10</b></div>
      <div className={s.muted} style={{ marginTop: 6 }}>Uses the last 7 days. Recovered pacts count 60% of an on-time pact. Coins and achievements are never touched.</div>
    </details>
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

/* ---- Batch 2 form pieces (Accountability only) ---- */
export function TLField({ n, label, children, hint }: { n: number; label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className={s.tl}>
      <span className={s.tlNum} aria-hidden="true">{String(n).padStart(2, "0")}</span>
      <div className={s.tlBody}><span className={s.tlLabel}>{label}</span>{children}{hint && <div className={s.tlHint}>{hint}</div>}</div>
    </div>
  );
}
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T | null; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className={s.segCtl} role="radiogroup" aria-label={label}>
      {options.map(o => <button type="button" key={o.id} role="radio" aria-checked={value === o.id} className={`${s.segOpt} ${value === o.id ? s.segOptOn : ""}`} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  );
}
export function Counter({ n, max }: { n: number; max: number }) {
  return <span className={s.counter} aria-live="polite">{n}/{max}</span>;
}
export function StepperBar({ step, total }: { step: number; total: number }) {
  return (
    <div className={s.stepper} role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => <span key={i} className={i < step ? s.stepOn : ""} />)}
    </div>
  );
}
export function StickyAction({ children, reason }: { children: ReactNode; reason?: string | null }) {
  return <div className={s.sticky}>{children}{reason && <div className={s.stickyWhy} role="status">{reason}</div>}</div>;
}
