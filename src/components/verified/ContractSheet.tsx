import { CONTRACT_REWARD_COINS } from "@/lib/coin-reward-config";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, ChevronDown, CalendarDays, Sparkles } from "lucide-react";
import { ContractButton, ContractStep, contractStyles as cs } from "./ContractVisuals";
import { CoinBadge } from "@/components/CoinBadge";
import { useDailyCoinRewards } from "@/hooks/useDailyCoinRewards";
import {
  CATEGORIES, PROOF_METHODS, REMINDER_PREFS, TEMPLATES, deviceTimezone, rescueMax, validate,
  type ContractForm,
} from "@/lib/verified/contracts";

type Goal = { id: string; title: string };

export function ContractSheet({ title, initial, goals, busy, serverError, onClose, onConfirm, hasPartner = false }: {
  title: string;
  initial: ContractForm;
  goals: Goal[];
  busy: boolean;
  serverError: string | null;
  onClose: () => void;
  onConfirm: (f: ContractForm, asDraft: boolean) => void;
  hasPartner?: boolean;
}) {
  const { daily } = useDailyCoinRewards();
  const [f, setF] = useState<ContractForm>(initial);
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const firstRef = useRef<HTMLInputElement>(null);
  const tz = deviceTimezone();

  useEffect(() => { firstRef.current?.focus(); }, [step]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [busy, onClose]);

  const set = <K extends keyof ContractForm>(k: K, v: ContractForm[K]) => setF(p => ({ ...p, [k]: v }));
  const suggest = () => {
    const t = TEMPLATES[f.category] ?? TEMPLATES.other;
    setF(p => ({ ...p, title: t.title, planned_min: t.planned, rescue_min: Math.min(p.rescue_min, rescueMax(t.planned)), proof_method: t.proof }));
  };
  const review = () => {
    const e = validate(f);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep("review");
  };
  const goalTitle = goals.find(g => g.id === f.goal_id)?.title;
  const visualErrors = validate(f);
  const selectWrap = (children: ReactNode) => <div className={cs.fieldWrap}>{children}<ChevronDown className={cs.fieldIcon} aria-hidden="true" /></div>;
  return (
    <div className={`${cs.scope} ${cs.backdrop}`} role="dialog" aria-modal="true" aria-label={title} onClick={() => !busy && onClose()}>
      <div className={cs.sheet} onClick={e => e.stopPropagation()}>
        <div className={cs.handle} aria-hidden="true" />
        <header className={cs.sheetHeader}>
          <div><div className={cs.mono}>AXEN · CONTRACT</div><h2>{step === "edit" ? title : "Review contract"}</h2></div>
           <CoinBadge amount={CONTRACT_REWARD_COINS} state={!daily || daily.contract_claimed ? "disabled" : "available"} />
           <button className={cs.close} aria-label="Close" onClick={onClose} disabled={busy}><X size={20} /></button>
        </header>
        <p className={cs.note}>{daily?.contract_claimed ? "Daily reward claimed · resets at midnight" : "Complete the full contract to earn"}</p>
        {step === "edit" ? <>
          <div className={cs.stepper}>
            <ContractStep number={1} label="Category" complete={!visualErrors.category}>
              {selectWrap(<select id="c-cat" aria-label="Category" className={cs.field} value={f.category} onChange={e => set("category", e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select>)}
              <label className={cs.fieldLabel} htmlFor="c-goal">Linked goal (optional)</label>
              {selectWrap(<select id="c-goal" className={cs.field} value={f.goal_id ?? ""} onChange={e => set("goal_id", e.target.value || null)}><option value="">No goal</option>{goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select>)}
            </ContractStep>
            <ContractStep number={2} label="What exactly will you do?" complete={!visualErrors.title}>
              <input id="c-title" aria-label="What exactly will you do?" ref={firstRef} className={cs.field} value={f.title} maxLength={120} onChange={e => set("title", e.target.value)} placeholder="e.g. Study one chapter with notes" aria-invalid={!!errors.title} />
              <ContractButton secondary type="button" onClick={suggest} className={cs.suggest}><Sparkles size={15} />Suggest for {f.category}</ContractButton>
              {errors.title && <div className={cs.error}>{errors.title}</div>}
            </ContractStep>
            <ContractStep number={3} label={`Date & time · ${tz}`} complete={!visualErrors.local}>
              <div className={cs.fieldWrap}><input id="c-when" aria-label={`Date & time (${tz})`} type="datetime-local" className={cs.field} value={f.local} onChange={e => set("local", e.target.value)} aria-invalid={!!errors.local} /><CalendarDays className={`${cs.fieldIcon} ${cs.calendar}`} aria-hidden="true" /></div>
              {errors.local && <div className={cs.error}>{errors.local}</div>}
            </ContractStep>
            <ContractStep number={4} label="Commitment" complete={!visualErrors.planned_min && !visualErrors.rescue_min && !visualErrors.difficulty}>
              <div className={cs.stats}>
                <div className={`${cs.tile} ${cs.tileField}`}><label className={cs.mono} htmlFor="c-dur">Duration</label><div className={cs.numberWrap}><input id="c-dur" type="number" inputMode="numeric" min={5} max={240} value={f.planned_min} onChange={e => set("planned_min", parseInt(e.target.value || "0", 10))} /><small>min</small></div></div>
                <div className={`${cs.tile} ${cs.tileField}`}><label className={cs.mono} htmlFor="c-res">Rescue</label><div className={cs.numberWrap}><input id="c-res" type="number" inputMode="numeric" min={1} max={rescueMax(f.planned_min)} value={f.rescue_min} onChange={e => set("rescue_min", parseInt(e.target.value || "0", 10))} /><small>min</small></div></div>
                <div className={`${cs.tile} ${cs.tileField}`}><label className={cs.mono} htmlFor="c-diff">Difficulty</label><div className={cs.numberWrap}><select id="c-diff" aria-label="Difficulty" value={f.difficulty} onChange={e => set("difficulty", Number(e.target.value))}>{[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}</select></div></div>
              </div>
              {errors.planned_min && <div className={cs.error}>{errors.planned_min}</div>}{errors.rescue_min && <div className={cs.error}>{errors.rescue_min}</div>}
            </ContractStep>
            <ContractStep number={5} label="Proof method" complete={!visualErrors.proof_method}>
              {selectWrap(<select id="c-proof" aria-label="Proof method" className={cs.field} value={f.proof_method} onChange={e => set("proof_method", e.target.value)}>{PROOF_METHODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>)}
            </ContractStep>
            <ContractStep number={6} label="Reminder" complete={!!f.reminder_pref}>
              {selectWrap(<select id="c-rem" aria-label="Reminder" className={cs.field} value={f.reminder_pref} onChange={e => set("reminder_pref", e.target.value)}>{REMINDER_PREFS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>)}
            </ContractStep>
            <ContractStep number={7} label="Cue (optional)" complete={!!f.trigger_text.trim() && !visualErrors.trigger_text}>
              <input id="c-cue" aria-label="Cue (optional)" className={cs.field} maxLength={200} value={f.trigger_text} onChange={e => set("trigger_text", e.target.value)} placeholder="After breakfast, at my desk" />
            </ContractStep>
            <ContractStep number={8} label="Private note (optional)" complete={!!f.private_note.trim() && !visualErrors.private_note}>
              <textarea id="c-note" aria-label="Private note (optional)" className={cs.field} rows={3} maxLength={500} value={f.private_note} onChange={e => set("private_note", e.target.value)} />
            </ContractStep>
          </div>
          <div className={cs.partner}>{hasPartner ? <label>Share with my accountability partner<input type="checkbox" aria-label="Share with my accountability partner" checked={!!f.accountability} onChange={e => setF(p => ({ ...p, accountability: e.target.checked }))} /></label> : "Add an accountability partner in Profile to share progress."}</div>
          <footer className={cs.footer}><ContractButton onClick={review}>Review</ContractButton></footer>
        </> : <>
          <div className={cs.review}><dl>
            <dt>Action</dt><dd>{f.title.trim()}</dd><dt>Goal</dt><dd>{goalTitle ?? "None"}</dd>
            <dt>When</dt><dd>{new Date(f.local).toLocaleString()} · {tz}</dd>
            <dt>Duration</dt><dd>{f.planned_min} min · rescue {f.rescue_min} min</dd>
            <dt>Proof</dt><dd>{PROOF_METHODS.find(p => p.id === f.proof_method)?.label}</dd>
            <dt>Difficulty</dt><dd>{f.difficulty}/3</dd><dt>Reminder</dt><dd>{REMINDER_PREFS.find(p => p.id === f.reminder_pref)?.label}</dd>
          </dl>{serverError && <div role="alert" className={cs.error}>{serverError}</div>}</div>
          <footer className={cs.footer}><ContractButton onClick={() => onConfirm(f, false)} disabled={busy} aria-busy={busy}>{busy ? "Saving…" : "Confirm contract"}</ContractButton>
            <div className={cs.actions}><ContractButton secondary onClick={() => setStep("edit")} disabled={busy}>Edit</ContractButton><ContractButton secondary onClick={() => onConfirm(f, true)} disabled={busy}>Save as draft</ContractButton></div>
          </footer>
        </>}
      </div>
    </div>
  );
}
