import { useEffect, useRef, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { AX, buttonStyle, subText } from "@/tabs/styles";
import {
  CATEGORIES, PROOF_METHODS, REMINDER_PREFS, TEMPLATES, deviceTimezone, rescueMax, validate,
  type ContractForm,
} from "@/lib/verified/contracts";

type Goal = { id: string; title: string };

const field: CSSProperties = {
  width: "100%", minHeight: 44, padding: "10px 12px", borderRadius: 12, background: "#181820",
  border: `1px solid ${AX.border}`, color: AX.text, fontFamily: AX.font, fontSize: 14, outline: "none",
  boxSizing: "border-box",
};
const label: CSSProperties = { display: "block", fontSize: 12, color: AX.muted, margin: "12px 0 6px" };
const err: CSSProperties = { fontSize: 12, color: AX.danger, marginTop: 4 };

export function ContractSheet({ title, initial, goals, busy, serverError, onClose, onConfirm }: {
  title: string;
  initial: ContractForm;
  goals: Goal[];
  busy: boolean;
  serverError: string | null;
  onClose: () => void;
  onConfirm: (f: ContractForm, asDraft: boolean) => void;
}) {
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

  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={() => !busy && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(5,5,9,0.82)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", background: AX.surface,
        border: `1px solid ${AX.border}`, borderRadius: "20px 20px 0 0", padding: 18,
        paddingBottom: "calc(18px + env(safe-area-inset-bottom))", fontFamily: AX.font, color: AX.text,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <strong style={{ fontSize: 17 }}>{step === "edit" ? title : "Review contract"}</strong>
          <button aria-label="Close" onClick={onClose} disabled={busy} style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: `1px solid ${AX.border}`, color: AX.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
        </div>

        {step === "edit" ? (
          <>
            <label style={label} htmlFor="c-goal">Linked goal (optional)</label>
            <select id="c-goal" style={field} value={f.goal_id ?? ""} onChange={e => set("goal_id", e.target.value || null)}>
              <option value="">No goal</option>
              {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>

            <label style={label} htmlFor="c-cat">Category</label>
            <select id="c-cat" style={field} value={f.category} onChange={e => set("category", e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
            </select>

            <label style={label} htmlFor="c-title">What exactly will you do?</label>
            <input id="c-title" ref={firstRef} style={field} value={f.title} maxLength={120} onChange={e => set("title", e.target.value)} placeholder="e.g. Study one chapter with notes" aria-invalid={!!errors.title} />
            <button type="button" onClick={suggest} style={{ ...buttonStyle("ghost"), padding: "8px 12px", fontSize: 12, marginTop: 8 }}>Suggest for {f.category}</button>
            {errors.title && <div style={err}>{errors.title}</div>}

            <label style={label} htmlFor="c-when">Date & time ({tz})</label>
            <input id="c-when" type="datetime-local" style={field} value={f.local} onChange={e => set("local", e.target.value)} aria-invalid={!!errors.local} />
            {errors.local && <div style={err}>{errors.local}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={label} htmlFor="c-dur">Duration (min)</label>
                <input id="c-dur" type="number" inputMode="numeric" min={5} max={360} style={field} value={f.planned_min} onChange={e => set("planned_min", parseInt(e.target.value || "0", 10))} />
                {errors.planned_min && <div style={err}>{errors.planned_min}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <label style={label} htmlFor="c-res">Rescue (min)</label>
                <input id="c-res" type="number" inputMode="numeric" min={1} max={rescueMax(f.planned_min)} style={field} value={f.rescue_min} onChange={e => set("rescue_min", parseInt(e.target.value || "0", 10))} />
                {errors.rescue_min && <div style={err}>{errors.rescue_min}</div>}
              </div>
            </div>

            <label style={label} htmlFor="c-proof">Proof method</label>
            <select id="c-proof" style={field} value={f.proof_method} onChange={e => set("proof_method", e.target.value)}>
              {PROOF_METHODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={label} htmlFor="c-diff">Difficulty</label>
                <select id="c-diff" style={field} value={f.difficulty} onChange={e => set("difficulty", Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div style={{ flex: 1.4 }}>
                <label style={label} htmlFor="c-rem">Reminder</label>
                <select id="c-rem" style={field} value={f.reminder_pref} onChange={e => set("reminder_pref", e.target.value)}>
                  {REMINDER_PREFS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <label style={label} htmlFor="c-cue">Cue (optional)</label>
            <input id="c-cue" style={field} maxLength={200} value={f.trigger_text} onChange={e => set("trigger_text", e.target.value)} placeholder="After breakfast, at my desk" />

            <label style={label} htmlFor="c-note">Private note (optional)</label>
            <textarea id="c-note" style={{ ...field, minHeight: 64 }} maxLength={500} value={f.private_note} onChange={e => set("private_note", e.target.value)} />

            <div style={{ ...subText, marginTop: 12 }}>Accountability partner — coming soon.</div>

            <button onClick={review} style={{ ...buttonStyle(), width: "100%", marginTop: 16, minHeight: 48 }}>Review</button>
          </>
        ) : (
          <>
            <dl style={{ margin: "10px 0", display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 14 }}>
              <dt style={{ color: AX.muted }}>Action</dt><dd style={{ margin: 0 }}>{f.title.trim()}</dd>
              <dt style={{ color: AX.muted }}>Goal</dt><dd style={{ margin: 0 }}>{goalTitle ?? "None"}</dd>
              <dt style={{ color: AX.muted }}>When</dt><dd style={{ margin: 0 }}>{new Date(f.local).toLocaleString()} · {tz}</dd>
              <dt style={{ color: AX.muted }}>Duration</dt><dd style={{ margin: 0 }}>{f.planned_min} min · rescue {f.rescue_min} min</dd>
              <dt style={{ color: AX.muted }}>Proof</dt><dd style={{ margin: 0 }}>{PROOF_METHODS.find(p => p.id === f.proof_method)?.label}</dd>
              <dt style={{ color: AX.muted }}>Difficulty</dt><dd style={{ margin: 0 }}>{f.difficulty}/5</dd>
              <dt style={{ color: AX.muted }}>Reminder</dt><dd style={{ margin: 0 }}>{REMINDER_PREFS.find(p => p.id === f.reminder_pref)?.label}</dd>
            </dl>
            {serverError && <div role="alert" style={{ ...err, fontSize: 13, margin: "8px 0" }}>{serverError}</div>}
            <button onClick={() => onConfirm(f, false)} disabled={busy} aria-busy={busy} style={{ ...buttonStyle(), width: "100%", minHeight: 48, opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : "Confirm contract"}</button>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button onClick={() => setStep("edit")} disabled={busy} style={{ ...buttonStyle("ghost"), flex: 1 }}>Edit</button>
              <button onClick={() => onConfirm(f, true)} disabled={busy} style={{ ...buttonStyle("ghost"), flex: 1 }}>Save as draft</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
