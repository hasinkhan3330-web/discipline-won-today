import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { GOAL_PLANS, type GoalPlanKey } from "@/lib/economy";
import s from "./goal-plan-dot.module.css";

/** Glowing dot that opens the Goal plan picker. Replaces the inline plan buttons. */
export function GoalPlanDot({ plan, locked, onSelect, helpLines }: {
  plan: GoalPlanKey; locked: boolean; onSelect: (key: GoalPlanKey) => void; helpLines: string[];
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const close = () => { setClosing(true); window.setTimeout(() => { setOpen(false); setClosing(false); }, 220); };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pick = (key: GoalPlanKey) => {
    if (locked && key !== plan) return;
    onSelect(key);
    window.setTimeout(close, 260);
  };

  return (
    <>
      <button type="button" className="axh-dot" aria-label="Choose goal plan" aria-haspopup="dialog" onClick={() => setOpen(true)}>•</button>
      {open && typeof document !== "undefined" && createPortal(
        <div className={`${s.scrim} ${closing ? s.out : ""}`} role="presentation" onClick={close}>
          <div className={s.sheet} role="dialog" aria-modal="true" aria-label="Goal plan" onClick={event => event.stopPropagation()}>
            <i className={s.grip} />
            <p className={s.eyebrow}>AXEN · Goal plan</p>
            <h3 className={s.title}>Choose your plan</h3>
            <div className={s.list} role="radiogroup" aria-label="Goal plan">
              {GOAL_PLANS.map((p, i) => {
                const on = plan === p.key;
                return (
                  <button type="button" key={p.key} role="radio" aria-checked={on}
                    disabled={locked && !on} style={{ animationDelay: `${80 + i * 60}ms` }}
                    className={`${s.option} ${on ? s.on : ""}`} onClick={() => pick(p.key)}>
                    <span className={s.copy}>
                      <b>{p.short}</b>
                      <span>{p.target.toLocaleString()} coins · 90% Success Guarantee</span>
                    </span>
                    <span className={s.tick} aria-hidden>{on && <Check size={14} />}</span>
                  </button>
                );
              })}
            </div>
            {locked && <p className={s.note}>The plan can't be changed while editing a goal.</p>}
            <ul className={s.help}>{helpLines.map(line => <li key={line}>{line}</li>)}</ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
