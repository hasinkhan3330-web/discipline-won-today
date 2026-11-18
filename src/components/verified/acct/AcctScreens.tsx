import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";
import { CATEGORIES, REMINDER_PREFS, deviceTimezone, friendlyError, rescueMax, toLocalInput } from "@/lib/verified/contracts";
import { scheduleContractReminders } from "@/lib/verified/contract-reminders";
import type { ContractRow } from "@/lib/verified/contracts";
import { ARing, Counter, ScoreRules, Segmented, StageRow, Switch, StepperBar, StickyAction, SubHeader, TLField, Tree, ymd } from "./AcctUI";
import { addMinutesLocal, dayOffset, fmtLocal, fmtTime, onDayOf, setTime12, to12 } from "./datetime";
import { ArrowRight, BookOpen, Briefcase, Check, Clock3, Dumbbell, Flower2, GraduationCap, Minus, Palette, Plus, Sparkles } from "lucide-react";
import s from "./acct.module.css";

export type Garden = { score: number; stage: number; stage_name: string; points_to_next: number; due: number; overdue: number; checkin_days: number; resting: boolean };
export type Report = { total: number; completed: number; missed: number; recovered: number; pending_reviews: number; avg_review_minutes: number | null; focus_minutes: number; days: { day: string; total: number; done: number }[] | null; best_day: string | null };
export type Trust = { confirmed: number; disputed: number; recoveries: number; abandoned: number; on_time: number; reviewed: number; threshold: number; score: number | null };

const EVIDENCE = [
  { id: "session", label: "Focus timer", proof: "timer" },
  { id: "checkin", label: "Self check-in", proof: "checklist" },
  { id: "photo", label: "Photo", proof: "photo" },
  { id: "none", label: "No extra proof", proof: "timer" },
] as const;

/** Pure: validates the one-time pact form (today or tomorrow, deadline after start). */
export function validatePact(f: { title: string; start: string; minutes: number; deadline: string }, now = new Date()): string | null {
  if (f.title.trim().length < 3 || f.title.trim().length > 120) return "Give your pact a title (3–120 characters).";
  const st = new Date(f.start), dl = new Date(f.deadline);
  if (isNaN(st.getTime())) return "Pick a start time.";
  if (st.getTime() < now.getTime() - 60_000) return "Pick a start time in the future.";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDay = new Date(st.getFullYear(), st.getMonth(), st.getDate());
  const diff = Math.round((startDay.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0 || diff > 1) return "One-time pacts are for today or tomorrow.";
  if (!Number.isInteger(f.minutes) || f.minutes < 5 || f.minutes > 240) return "Session length must be 5–240 minutes.";
  if (isNaN(dl.getTime()) || dl.getTime() < st.getTime() + f.minutes * 60_000) return "Deadline must be after the session ends.";
  return null;
}

export type PactPreset = { title: string; minutes: number; category: string };
export function PactCreator({ hasPartner, onBack, onSaved, preset }: { hasPartner: boolean; onBack: () => void; onSaved: () => void; preset?: PactPreset | null }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const init = () => { const d = new Date(Date.now() + 30 * 60_000); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); return d; };
  const [f, setF] = useState(() => {
    const st = init(); const dl = new Date(st.getTime() + 3 * 3600_000);
    return { title: preset?.title ?? "", target: "", category: preset?.category ?? "study", day: "today" as "today" | "tomorrow", start: toLocalInput(st), minutes: preset?.minutes ?? 30, deadline: toLocalInput(dl),
      minimum: "", ifThen: "", obstacles: "", evidence: "session", visibility: hasPartner ? "partner" : "private", solo: !hasPartner, reminder: "standard" };
  });
  const set = (k: string, v: unknown) => setF(p => ({ ...p, [k]: v }));
  const err = validatePact(f);
  const pickDay = (d: "today" | "tomorrow") => {
    const st = new Date(f.start), dl = new Date(f.deadline);
    const base = new Date(); if (d === "tomorrow") base.setDate(base.getDate() + 1);
    st.setFullYear(base.getFullYear(), base.getMonth(), base.getDate()); dl.setFullYear(base.getFullYear(), base.getMonth(), base.getDate());
    setF(p => ({ ...p, day: d, start: toLocalInput(st), deadline: toLocalInput(dl) }));
  };
  const save = async () => {
    if (err || busy) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw { code: "42501", message: "JWT" };
      const ev = EVIDENCE.find(e => e.id === f.evidence) ?? EVIDENCE[0];
      const tz = deviceTimezone();
      const row = {
        user_id: u.user.id, goal_id: null, title: f.title.trim(), category: f.category,
        scheduled_at: new Date(f.start).toISOString(), timezone: tz, local_day: f.start.slice(0, 10),
        planned_seconds: f.minutes * 60, rescue_seconds: Math.min(10, rescueMax(f.minutes)) * 60,
        trigger_text: null, proof_method: ev.proof, difficulty: 2, reminder_pref: f.reminder, private_note: null,
        accountability_enabled: !f.solo && hasPartner, status: "scheduled" as const,
        deadline_at: new Date(f.deadline).toISOString(), done_criteria: f.target.trim() || null,
        fallback_action: f.ifThen.trim() || null, minimum_version: f.minimum.trim() || null, obstacles: f.obstacles.trim() || null,
        evidence_required: f.evidence, is_solo: f.solo || !hasPartner, partner_visibility: f.solo || !hasPartner ? "private" : f.visibility,
      };
      const { data, error } = await supabase.from("daily_contracts").insert(row).select().single();
      if (error) throw error;
      haptic("success"); toast.success("Pact saved");
      if (f.reminder !== "none") void scheduleContractReminders(data as ContractRow).catch(() => {});
      window.dispatchEvent(new Event("axen:contract-changed"));
      onSaved();
    } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); }
  };
  const titleWhy = f.title.trim().length < 3 ? "Give your pact a title (3+ characters) to continue." : null;
  const reviewEv = EVIDENCE.find(e => e.id === f.evidence)?.label ?? "Focus timer";
  const reviewRem = REMINDER_PREFS.find(r => r.id === f.reminder)?.label ?? f.reminder;
  const setStart = (v: string) => {
    const off = dayOffset(toLocalInput(new Date()), v);
    setF(p => ({ ...p, start: v, day: off === 1 ? "tomorrow" : off === 0 ? "today" : p.day }));
  };
  return (
    <div>
      <SubHeader title="New pact" onBack={step === 1 ? onBack : () => setStep(step - 1)} right={<span className={s.chip}>Step {step} of 3</span>} />
      <StepperBar step={step} total={3} />
      {step === 1 && <div className={s.card}>
        <TLField n={1} label="What will you commit to?" hint="Short and specific works best.">
          <input className={s.fInput} value={f.title} maxLength={120} onChange={e => set("title", e.target.value)} placeholder="e.g. Study one chapter of Physics" aria-label="What will you commit to?" />
          <Counter n={f.title.length} max={120} />
        </TLField>
        <TLField n={2} label={`Target action (what "done" looks like)`} hint={`Example: "Solve 20 questions from Exercise 3.2"`}>
          <input className={s.fInput} value={f.target} maxLength={200} onChange={e => set("target", e.target.value)} placeholder="e.g. Finish notes for chapter 4" aria-label="Target action" />
          <Counter n={f.target.length} max={200} />
        </TLField>
        <TLField n={3} label="Category">
          <div className={s.chipRow} role="radiogroup" aria-label="Category">{CATEGORIES.map(c => { const Icon = CAT_ICON[c] ?? Sparkles;
            return <button type="button" key={c} role="radio" aria-checked={f.category === c} className={`${s.chipBtn} ${f.category === c ? s.chipBtnOn : ""}`} onClick={() => set("category", c)}><Icon size={15} />{cap(c)}</button>; })}</div>
        </TLField>
        <TLField n={4} label="When (one-time pact)">
          <Segmented label="Day" value={f.day} onChange={pickDay} options={[{ id: "today", label: "Today" }, { id: "tomorrow", label: "Tomorrow" }]} />
          <span className={s.miniLabel}>Start</span>
          <DateTimePicker label="Start" value={f.start} onChange={setStart} />
          <span className={s.miniLabel}>Deadline</span>
          <DateTimePicker label="Deadline" value={f.deadline} onChange={v => set("deadline", v)} dayBase={f.start} />
          <span className={s.miniLabel}>Session length</span>
          <MinutesStepper value={f.minutes} onChange={v => set("minutes", v)} />
        </TLField>
        <div className={s.contractCard} style={{ marginBottom: 0 }}>
          <span className={s.monoTag}>Summary</span>
          <div className={s.sumLine}>{f.minutes}-min {f.category} · {fmtTime(f.start)}–{fmtTime(f.deadline)}</div>
          <div className={s.muted} style={{ marginTop: 2 }}>{fmtLocal(f.start)}</div>
          {err && !titleWhy && <div role="alert" className={s.errLine}>{err}</div>}
        </div>
      </div>}
      {step === 2 && <div className={s.card}>
        <TLField n={1} label="Minimum version (on a hard day)">
          <input className={s.fInput} value={f.minimum} maxLength={140} onChange={e => set("minimum", e.target.value)} placeholder="e.g. Read 5 pages" aria-label="Minimum version" />
          <Counter n={f.minimum.length} max={140} />
        </TLField>
        <TLField n={2} label="If-Then backup">
          <input className={s.fInput} value={f.ifThen} maxLength={200} onChange={e => set("ifThen", e.target.value)} placeholder="If I'm late, then I'll do the minimum version" aria-label="If-Then backup" />
          <Counter n={f.ifThen.length} max={200} />
        </TLField>
        <TLField n={3} label="Obstacles (optional)">
          <input className={s.fInput} value={f.obstacles} maxLength={280} onChange={e => set("obstacles", e.target.value)} placeholder="e.g. Phone notifications, late dinner" aria-label="Obstacles" />
          <Counter n={f.obstacles.length} max={280} />
        </TLField>
        <TLField n={4} label="Evidence">
          <div className={s.chipRow} role="radiogroup" aria-label="Evidence">{EVIDENCE.map(e => <button type="button" key={e.id} role="radio" aria-checked={f.evidence === e.id} className={`${s.chipBtn} ${f.evidence === e.id ? s.chipBtnOn : ""}`} onClick={() => set("evidence", e.id)}>{e.label}</button>)}</div>
        </TLField>
      </div>}
      {step === 3 && <>
        <div className={s.card}>
          <TLField n={1} label="Partner">
            {hasPartner ? <Segmented label="Partner" value={f.solo ? "solo" : "partner"} onChange={v => set("solo", v === "solo")} options={[{ id: "partner", label: "With my partner" }, { id: "solo", label: "Solo" }]} />
              : <div className={s.muted}>Solo pact — you confirm your own proof.</div>}
          </TLField>
          {hasPartner && !f.solo && <TLField n={2} label="Who can see this pact">
            <Segmented label="Who can see this pact" value={f.visibility} onChange={v => set("visibility", v)} options={[{ id: "partner", label: "My partner" }, { id: "private", label: "Only me" }]} />
          </TLField>}
          <TLField n={hasPartner && !f.solo ? 3 : 2} label="Reminder">
            <div className={s.chipRow} role="radiogroup" aria-label="Reminder">{REMINDER_PREFS.map(r => <button type="button" key={r.id} role="radio" aria-checked={f.reminder === r.id} className={`${s.chipBtn} ${f.reminder === r.id ? s.chipBtnOn : ""}`} onClick={() => set("reminder", r.id)}>{r.label}</button>)}</div>
          </TLField>
          <div className={s.muted}>Your partner never sees notes, coins or full history.</div>
        </div>
        <div className={s.contractCard}>
          <span className={s.monoTag}>Review</span>
          <div className={s.sumLine} style={{ marginBottom: 6 }}>{f.title.trim() || "Untitled pact"}</div>
          <div className={s.revRow}><span>Time</span><span>{fmtLocal(f.start)} → {fmtTime(f.deadline)}{dayOffset(f.start, f.deadline) > 0 ? " (next day)" : ""}</span></div>
          <div className={s.revRow}><span>Length</span><span>{f.minutes} min · {cap(f.category)}</span></div>
          {f.target.trim() && <div className={s.revRow}><span>Done means</span><span>{f.target.trim()}</span></div>}
          <div className={s.revRow}><span>Evidence</span><span>{reviewEv}</span></div>
          <div className={s.revRow}><span>Partner</span><span>{f.solo || !hasPartner ? "Solo" : f.visibility === "partner" ? "With partner · partner can see" : "With partner · only me"}</span></div>
          <div className={s.revRow}><span>Reminder</span><span>{reviewRem}</span></div>
        </div>
      </>}
      <StickyAction reason={step === 1 ? titleWhy : step === 3 ? err : null}>
        {step < 3
          ? <button className={s.limeBtn} onClick={() => setStep(step + 1)} disabled={step === 1 && f.title.trim().length < 3}>Next <ArrowRight size={18} /></button>
          : <button className={s.limeBtn} onClick={() => void save()} disabled={!!err || busy}>{busy ? "Saving…" : "Save pact"}</button>}
      </StickyAction>
    </div>
  );
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const CAT_ICON: Record<string, typeof Sparkles> = { study: GraduationCap, work: Briefcase, workout: Dumbbell, meditation: Flower2, reading: BookOpen, creative: Palette, other: Sparkles };
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function DateTimePicker({ label, value, onChange, dayBase }: { label: string; value: string; onChange: (v: string) => void; dayBase?: string }) {
  const [open, setOpen] = useState(false);
  const t = to12(value);
  const off = dayBase ? dayOffset(dayBase, value) : 0;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button type="button" className={`${s.pickBtn} ${open ? s.pickBtnOpen : ""}`} aria-expanded={open} aria-label={`${label}: ${fmtLocal(value)}`} onClick={() => setOpen(o => !o)}>
        <span>{fmtLocal(value)}</span><Clock3 size={16} color="var(--a-ring)" />
      </button>
      <div className={s.chipRow}>{([[30, "+30m"], [60, "+1h"], [180, "+3h"]] as const).map(([m, l]) =>
        <button type="button" key={l} className={s.chipBtn} aria-label={`${label} ${l}`} onClick={() => onChange(addMinutesLocal(value, m))}>{l}</button>)}</div>
      {open && <div className={s.pickPanel}>
        {dayBase && <Segmented label={`${label} day`} value={off >= 1 ? "next" : "same"} onChange={v => onChange(onDayOf(dayBase, value, v === "next" ? 1 : 0))} options={[{ id: "same", label: "Same day" }, { id: "next", label: "Next day" }]} />}
        <span className={s.miniLabel}>Hour</span>
        <div className={s.grid6}>{HOURS.map(h => <button type="button" key={h} aria-pressed={t.h === h} className={`${s.gridBtn} ${t.h === h ? s.gridBtnOn : ""}`} onClick={() => onChange(setTime12(value, h, t.m, t.ap))}>{h}</button>)}</div>
        <span className={s.miniLabel}>Minute</span>
        <div className={s.grid6}>{MINS.map(m => <button type="button" key={m} aria-pressed={t.m === m} className={`${s.gridBtn} ${t.m === m ? s.gridBtnOn : ""}`} onClick={() => onChange(setTime12(value, t.h, m, t.ap))}>{String(m).padStart(2, "0")}</button>)}</div>
        <Segmented label="AM or PM" value={t.ap} onChange={ap => onChange(setTime12(value, t.h, t.m, ap))} options={[{ id: "AM", label: "AM" }, { id: "PM", label: "PM" }]} />
        <button type="button" className={s.chipBtn} style={{ justifySelf: "end" }} onClick={() => setOpen(false)}>Done</button>
      </div>}
    </div>
  );
}

function MinutesStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.max(5, Math.min(240, v));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className={s.minStep}>
        <button type="button" className={s.round} aria-label="Shorter by 5 minutes" onClick={() => onChange(clamp(value - 5))} disabled={value <= 5}><Minus size={16} /></button>
        <b aria-live="polite">{value}<small>min</small></b>
        <button type="button" className={s.round} aria-label="Longer by 5 minutes" onClick={() => onChange(clamp(value + 5))} disabled={value >= 240}><Plus size={16} /></button>
      </div>
      <div className={s.chipRow}>{[15, 25, 30, 45, 60].map(m => <button type="button" key={m} aria-pressed={value === m} className={`${s.chipBtn} ${value === m ? s.chipBtnOn : ""}`} onClick={() => onChange(m)}>{m}m</button>)}</div>
    </div>
  );
}

export function CheckinScreen({ hasPartner, onBack, onDone }: { hasPartner: boolean; onBack: () => void; onDone: () => void }) {
  const day = ymd(new Date());
  const [f, setF] = useState<{ action: string; completed: boolean | null; needs_help: boolean | null; next_step: string }>({ action: "", completed: null, needs_help: null, next_step: "" });
  const [loaded, setLoaded] = useState(false);
  const [partner, setPartner] = useState<{ checked_in: boolean; completed: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [cheerBusy, setCheerBusy] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("acct_checkins").select("action,completed,needs_help,next_step").eq("day", day).maybeSingle();
      if (data) setF({ action: data.action ?? "", completed: data.completed, needs_help: data.needs_help, next_step: data.next_step ?? "" });
      if (hasPartner) { const r = await supabase.rpc("acct_partner_checkin_status"); setPartner((r.data as any) ?? null); }
      setLoaded(true);
    })();
  }, [day, hasPartner]);
  const ready = f.completed !== null && f.needs_help !== null;
  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("acct_checkins").upsert({ user_id: u.user?.id, day, action: f.action.trim() || null, completed: !!f.completed, needs_help: !!f.needs_help, next_step: f.next_step.trim() || null }, { onConflict: "user_id,day" });
    setBusy(false);
    if (error) toast.error("Couldn't save your check-in. Try again.");
    else { haptic("success"); toast.success("Checked in"); setDone(true); window.setTimeout(onDone, 1600); }
  };
  const cheer = async (k: "fire" | "clap" | "muscle") => {
    if (cheerBusy) return;
    setCheerBusy(k);
    const { data, error } = await supabase.rpc("acct_send_cheer", { _kind: k });
    setCheerBusy(null);
    if (error) toast.error("Couldn't send"); else { haptic("success"); setSent(p => ({ ...p, [k]: true })); toast.success(data ? "Cheer sent" : "Already sent that one today"); }
  };
  if (!loaded) return <div><SubHeader title="Daily check-in" onBack={onBack} /><div className={s.skel} /><div className={s.skel} /></div>;
  if (done) return (
    <div>
      <SubHeader title="Daily check-in" onBack={onDone} />
      <div className={s.celebrateBox} role="status">
        <div className={s.celebrateIcon}><Check size={32} strokeWidth={3} /></div>
        <div className={s.secTitle} style={{ fontSize: 20 }}>Checked in</div>
        {hasPartner && <div className={s.muted} style={{ fontSize: 13, marginTop: 4 }}>Your partner will see this.</div>}
      </div>
    </div>
  );
  return (
    <div>
      <SubHeader title="Daily check-in" onBack={onBack} right={<span className={s.chip}>30 sec</span>} />
      <div className={s.card}>
        <TLField n={1} label="What is your most important action today?">
          <input className={s.fInput} maxLength={140} value={f.action} onChange={e => setF({ ...f, action: e.target.value })} placeholder="e.g. Finish 2 chapters of Chemistry" aria-label="Most important action today" />
          <Counter n={f.action.length} max={140} />
        </TLField>
        <TLField n={2} label="Did you complete your commitment?">
          <Segmented label="Did you complete your commitment?" value={f.completed === null ? null : f.completed ? "yes" : "no"} onChange={v => setF({ ...f, completed: v === "yes" })} options={[{ id: "yes", label: "Yes" }, { id: "no", label: "Not yet" }]} />
        </TLField>
        <TLField n={3} label="Do you need help adjusting your plan?">
          <Segmented label="Do you need help adjusting your plan?" value={f.needs_help === null ? null : f.needs_help ? "yes" : "no"} onChange={v => setF({ ...f, needs_help: v === "yes" })} options={[{ id: "yes", label: "Yes" }, { id: "no", label: "I'm fine" }]} />
        </TLField>
        <TLField n={4} label="What's your next step?">
          <input className={s.fInput} maxLength={140} value={f.next_step} onChange={e => setF({ ...f, next_step: e.target.value })} placeholder="e.g. Revise formulas before 9 PM" aria-label="Next step" />
          <Counter n={f.next_step.length} max={140} />
        </TLField>
        <button className={s.limeBtn} onClick={() => void save()} disabled={busy || !ready}>{busy ? "Saving…" : "Save check-in"}</button>
        {!ready && <div className={s.whyLine} role="status">Answer both questions to save.</div>}
      </div>
      {hasPartner && <div className={s.card}>
        <span className={s.tlLabel} style={{ paddingTop: 0 }}>Your partner today</span>
        <div className={s.who} style={{ marginTop: 8 }}>
          <span className={`${s.whoAv} ${s.whoP}`} aria-hidden="true">P{partner?.checked_in && <Check size={14} strokeWidth={3} />}</span>
          <span className={s.whoTxt}><b>{partner == null ? "—" : partner.checked_in ? (partner.completed ? "Checked in · commitment done" : "Checked in") : "Not checked in yet"}</b></span>
        </div>
        <span className={s.tlLabel} style={{ display: "block", margin: "12px 0 8px" }}>Send a cheer</span>
        <div className={s.cheerRow}>{([["fire", "🔥", "Fire"], ["clap", "👏", "Clap"], ["muscle", "💪", "Strong"]] as const).map(([k, e, l]) =>
          <button key={k} className={`${s.cheerBtn} ${sent[k] ? s.cheerSent : ""}`} aria-label={`Cheer ${k}${sent[k] ? " (sent)" : ""}`} onClick={() => void cheer(k)} disabled={cheerBusy !== null}><span aria-hidden="true">{e}</span><small>{sent[k] ? "Sent" : l}</small></button>)}</div>
      </div>}
    </div>
  );
}

export function GardenScreen({ garden, partnerStage, showTree, onToggleShow, onBack }: { garden: Garden | null; partnerStage: { stage: number; stage_name: string } | null; showTree: boolean; onToggleShow: (v: boolean) => void; onBack: () => void }) {
  const top = garden ? garden.points_to_next <= 0 : false;
  const goal = garden ? (top ? 100 : garden.score + garden.points_to_next) : 0;
  const status = !garden ? "" : garden.resting ? "Your tree is resting. Finish one pact to help it grow."
    : garden.due > 0 ? `${garden.due} pact${garden.due === 1 ? "" : "s"} due this week.` : top ? "Top stage reached. Keep it thriving." : "Finish one pact to help it grow.";
  return (
    <div>
      <SubHeader title="Focus garden" onBack={onBack} />
      {!garden ? <div className={s.skel} style={{ height: 300 }} /> : <div className={`${s.card} ${s.gardenHero}`}>
        <span className={s.heroLabel}>Your tree</span>
        <div className={s.gardenTree}><Tree stage={garden.stage} width={170} height={187} /></div>
        <div className={s.gardenName}>{garden.stage_name}</div>
        <div className={s.gardenBarRow}>
          <div className={s.neonBar} role="progressbar" aria-label="Garden score" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={garden.score}><i style={{ width: `${goal ? Math.min(100, garden.score / goal * 100) : 0}%` }} /></div>
          <span className={s.pillMono}>{garden.score} / {goal}</span>
        </div>
        <div className={s.muted} style={{ marginTop: 8 }}>{status}</div>
      </div>}
      {garden && <div className={s.card}><span className={s.label}>Stages</span><StageRow stage={garden.stage} /></div>}
      {garden && <div className={s.card}><ScoreRules /></div>}
      <div className={`${s.card} ${s.partnerTree}`}>
        <span className={s.label}>Partner's tree</span>
        {partnerStage ? <>
          <div className={s.garden}><Tree stage={partnerStage.stage} width={56} /><div><div className={s.big} style={{ fontSize: 16 }}>{partnerStage.stage_name}</div><span className={s.pillViolet}>Stage {partnerStage.stage} of 5</span></div></div>
          <StageRow stage={partnerStage.stage} violet />
        </> : <div className={s.muted}>Not shared or no partner yet.</div>}
        <div style={{ marginTop: 10 }}><Switch checked={showTree} onChange={onToggleShow} label="Show my tree to my partner" help="Your partner sees only your stage, never your score details." /></div>
      </div>
    </div>
  );
}

export function TrustWhy({ trust }: { trust: Trust | null }) {
  if (!trust) return <div className={s.muted}>Trust isn't available right now.</div>;
  return <>
    <div className={s.muted}>{trust.score == null ? `Still building — a number appears after ${trust.threshold} partner-reviewed sessions (${trust.reviewed} so far).` : "Based on how many reviewed sessions your partner confirmed, with a small bonus for starting on time."}</div>
    <div className={s.muted} style={{ marginTop: 6 }}>Last 60 days: {trust.confirmed} confirmed · {trust.recoveries} comebacks · {trust.disputed} disputed · {trust.on_time} on time.</div>
    <div className={s.muted} style={{ marginTop: 6 }}>Tip: start sessions on time and submit proof right after — it's the fastest way to build trust.</div>
  </>;
}

/** Pure: one supportive tip from real numbers only. */
export function reportTip(r: Report): string {
  if (r.total === 0) return "Create one small pact to start your week.";
  if (r.missed > r.completed) return "Try a smaller minimum version — finishing small beats skipping big.";
  if (r.pending_reviews > 0) return "Some proof is still waiting for review. A slow partner never counts against you.";
  if (r.completed === r.total) return "Every pact done this week. Keep the same time slot — it's working.";
  return "Your best days share a pattern. Repeat that start time.";
}

async function shareCard(r: Report) {
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1080;
  const g = c.getContext("2d"); if (!g) return;
  g.fillStyle = "#070b16"; g.fillRect(0, 0, 1080, 1080);
  g.fillStyle = "#4d7cff"; g.font = "600 56px sans-serif"; g.fillText("AXEN", 80, 140);
  g.fillStyle = "#e9edf7"; g.font = "500 64px sans-serif"; g.fillText("My week of discipline", 80, 260);
  const stats: [string, number][] = [["Pacts", r.total], ["Done", r.completed], ["Recovered", r.recovered], ["Focus min", r.focus_minutes]];
  stats.forEach(([l, v], i) => { const x = 80 + (i % 2) * 460, y = 400 + Math.floor(i / 2) * 260; g.fillStyle = "#0e1426"; g.fillRect(x, y, 420, 220); g.fillStyle = "#e9edf7"; g.font = "500 96px sans-serif"; g.fillText(String(v), x + 40, y + 130); g.fillStyle = "#8d96b8"; g.font = "36px sans-serif"; g.fillText(l, x + 40, y + 190); });
  g.fillStyle = "#8d96b8"; g.font = "32px sans-serif"; g.fillText("axonhabit.app", 80, 1000);
  const blob: Blob | null = await new Promise(res => c.toBlob(res, "image/png"));
  if (!blob) return;
  const file = new File([blob], "axen-week.png", { type: "image/png" });
  const nav = navigator as any;
  if (nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file], title: "My AXEN week" }); return; } catch { return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "axen-week.png"; a.click(); URL.revokeObjectURL(a.href);
}

export function ReportScreen({ trust, onBack }: { trust: Trust | null; onBack: () => void }) {
  const [r, setR] = useState<Report | null | undefined>(undefined);
  useEffect(() => { void supabase.rpc("acct_weekly_report").then(({ data, error }) => setR(error ? null : (data as any))); }, []);
  if (r === undefined) return <div><SubHeader title="Weekly report" onBack={onBack} /><div className={s.skel} /><div className={s.skel} /></div>;
  if (r === null) return <div><SubHeader title="Weekly report" onBack={onBack} /><div className={s.card} role="alert">Couldn't load your report. Try again later.</div></div>;
  const max = Math.max(1, ...(r.days ?? []).map(d => d.total));
  const tiles: [string, string | number][] = [["Pacts", r.total], ["Done", r.completed], ["Recovered", r.recovered], ["Missed", r.missed], ["Pending reviews", r.pending_reviews], ["Avg review", r.avg_review_minutes == null ? "—" : `${r.avg_review_minutes}m`], ["Focus min", r.focus_minutes]];
  return (
    <div>
      <SubHeader title="Weekly report" onBack={onBack} right={<span className={s.chip}>Last 7 days</span>} />
      {r.total === 0 && r.focus_minutes === 0 ? <div className={s.card}><div className={s.big}>No activity yet this week</div><div className={s.muted}>Your report fills in from real pacts and sessions.</div></div> : <>
        <div className={s.tiles}>{tiles.map(([l, v]) => <div key={l} className={s.tile}><b>{v}</b><span className={s.muted}>{l}</span></div>)}</div>
        <div className={s.card}>
          <span className={s.label}>Consistency</span>
          <div className={s.bars}>{(r.days ?? []).map(d => <div key={d.day} title={d.day} style={{ height: `${Math.max(8, (Math.max(d.total, 1) / max) * 100)}%`, background: d.done > 0 ? "var(--a-primary)" : "var(--a-chip)" }} />)}</div>
          {r.best_day && <div className={s.muted} style={{ marginTop: 8 }}>Best day: {new Date(r.best_day + "T12:00:00").toLocaleDateString([], { weekday: "long" })}</div>}
        </div>
      </>}
      <div className={s.card}><span className={s.label}>Tip</span><div>{reportTip(r)}</div></div>
      <div className={s.card}><span className={s.label}>Trust — why?</span><TrustWhy trust={trust} /></div>
      <button className={s.btn} onClick={() => void shareCard(r)}>Share report card</button>
    </div>
  );
}

export function MilestoneCelebration({ milestone, onClose }: { milestone: number; onClose: () => void }) {
  useEffect(() => { haptic("success"); }, []);
  const share = async () => { const t = `${milestone}-day pair streak on AXEN 🔥`; const nav = navigator as any; if (nav.share) { try { await nav.share({ text: t }); } catch { /* cancelled */ } } else { await navigator.clipboard?.writeText(t); toast.success("Copied"); } };
  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-label={`${milestone}-day pair streak`}>
      <div className={s.celebrate}>
        <div className={s.badge}>{milestone}</div>
        <div className={s.big} style={{ fontSize: 22 }}>{milestone}-day pair streak</div>
        <div className={s.muted}>You and your partner both showed up {milestone} days in a row.</div>
        <div className={s.stack}><button className={s.btn} onClick={onClose}>Continue</button><button className={`${s.btn} ${s.ghost}`} onClick={() => void share()}>Share</button></div>
      </div>
    </div>
  );
}

export { ARing };
