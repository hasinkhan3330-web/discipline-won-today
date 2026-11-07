import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getCoachV2State, runCoachToolFn } from "@/utils/coach-v2.functions";
import type { CoachPlan } from "@/lib/coach-plan-rules";
import s from "./coach-plan.module.css";

type PlanRow = { id: string; status: string; days: number; plan: CoachPlan; start_date: string | null } | null;
type State = { confidence: number; nextSlot: string | null; draft: PlanRow; confirmed: PlanRow };
const LENGTHS = [{ days: 1, label: "Today" }, { days: 7, label: "7 days" }, { days: 21, label: "21 days" }] as const;
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };

export function CoachPlanPanel({ refreshKey, onAskChange }: { refreshKey: number; onAskChange: (text: string) => void }) {
  const load = useServerFn(getCoachV2State); const run = useServerFn(runCoachToolFn);
  const [state, setState] = useState<State | null>(null);
  const [length, setLength] = useState<1 | 7 | 21>(7);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(() => load({ data: { timezone: tz() } }).then((r) => setState(r as State)).catch(() => {}), [load]);
  useEffect(() => { void refresh(); }, [refresh, refreshKey]);

  const act = async (name: "create_plan_draft" | "confirm_plan", args: Record<string, unknown> = {}) => {
    setBusy(name); setError(null);
    try { const r = await run({ data: { name, args } }); if (r && r.ok === false) setError(String(r.error ?? "Something went wrong.")); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(null); }
  };

  if (!state) return null;
  const pct = Math.round(state.confidence);
  const shown = state.draft ?? state.confirmed;
  const plan = shown?.plan;
  return (
    <div className={s.panel}>
      <button className={s.head} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={s.label}>Coach knows you</span>
        <span className={s.bar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="How well the coach knows you"><span style={{ width: `${pct}%` }} /></span>
        <span className={s.pct}>{pct}%</span>
      </button>
      {open && (
        <div className={s.body}>
          {pct < 70 && <p className={s.hint}>Chat a little more so your plan fits you. The coach still can build one now.</p>}
          {!state.draft && (
            <>
              <div className={s.lengths} role="radiogroup" aria-label="Plan length">
                {LENGTHS.map((l) => <button key={l.days} role="radio" aria-checked={length === l.days} className={length === l.days ? s.on : ""} onClick={() => setLength(l.days)}>{l.label}</button>)}
              </div>
              <button className={s.primary} disabled={!!busy} onClick={() => act("create_plan_draft", { days: length })}>{busy === "create_plan_draft" ? "Building your plan…" : state.confirmed ? "Build a new plan" : "Build my plan"}</button>
            </>
          )}
          {plan && (
            <div className={s.card}>
              <div className={s.cardTop}><b>{plan.title || "Your plan"}</b><span className={s.tag}>{shown!.status === "draft" ? "Draft" : "Active"} · {shown!.days === 1 ? "Today" : `${shown!.days} days`}</span></div>
              {plan.summary && <p className={s.summary}>{plan.summary}</p>}
              <ul className={s.tasks}>
                {(plan.days[0]?.tasks ?? []).map((t, i) => <li key={i}><span>{t.title}</span><small>{t.minutes} min · tiny version: {t.minimum}</small></li>)}
              </ul>
              {shown!.days > 1 && <p className={s.more}>Day 1 shown. {shown!.days - 1} more days are ready; each day's tasks are added to your habits that morning.</p>}
              {shown!.status === "draft" && (
                <div className={s.row}>
                  <button className={s.primary} disabled={!!busy} onClick={() => act("confirm_plan")}>{busy === "confirm_plan" ? "Starting…" : "Accept plan"}</button>
                  <button className={s.ghost} disabled={!!busy} onClick={() => onAskChange("I want to change my plan draft: ")}>Change</button>
                </div>
              )}
            </div>
          )}
          {error && <p className={s.error}>{error}</p>}
        </div>
      )}
    </div>
  );
}
