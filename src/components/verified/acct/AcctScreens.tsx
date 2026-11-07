import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";
import { CATEGORIES, REMINDER_PREFS, deviceTimezone, friendlyError, rescueMax, toLocalInput } from "@/lib/verified/contracts";
import { scheduleContractReminders } from "@/lib/verified/contract-reminders";
import type { ContractRow } from "@/lib/verified/contracts";
import { ARing, STAGE_NAMES, SubHeader, Tree, ymd } from "./AcctUI";
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

export function PactCreator({ hasPartner, onBack, onSaved }: { hasPartner: boolean; onBack: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const init = () => { const d = new Date(Date.now() + 30 * 60_000); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); return d; };
  const [f, setF] = useState(() => {
    const st = init(); const dl = new Date(st.getTime() + 3 * 3600_000);
    return { title: "", target: "", category: "study", day: "today" as "today" | "tomorrow", start: toLocalInput(st), minutes: 30, deadline: toLocalInput(dl),
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
  return (
    <div>
      <SubHeader title="New pact" onBack={step === 1 ? onBack : () => setStep(step - 1)} right={<span className={s.chip}>Step {step} of 3</span>} />
      {step === 1 && <div className={s.card}>
        <label className={s.field} style={{ marginTop: 0 }}><span className={s.label}>What will you commit to?</span>
          <input className={s.input} value={f.title} maxLength={120} onChange={e => set("title", e.target.value)} placeholder="e.g. Study one chapter" /></label>
        <label className={s.field}><span className={s.label}>Target action (what "done" looks like)</span>
          <input className={s.input} value={f.target} maxLength={200} onChange={e => set("target", e.target.value)} /></label>
        <span className={s.label} style={{ marginTop: 10 }}>Category</span>
        <div className={s.segs}>{CATEGORIES.map(c => <button key={c} className={`${s.seg} ${f.category === c ? s.segOn : ""}`} onClick={() => set("category", c)}>{c}</button>)}</div>
        <span className={s.label} style={{ marginTop: 10 }}>When (one-time pact)</span>
        <div className={s.segs}>{(["today", "tomorrow"] as const).map(d => <button key={d} className={`${s.seg} ${f.day === d ? s.segOn : ""}`} onClick={() => pickDay(d)}>{d === "today" ? "Today" : "Tomorrow"}</button>)}</div>
        <div className={s.row2}>
          <label><span className={s.label}>Start</span><input type="datetime-local" className={s.input} value={f.start} onChange={e => set("start", e.target.value)} /></label>
          <label><span className={s.label}>Deadline</span><input type="datetime-local" className={s.input} value={f.deadline} onChange={e => set("deadline", e.target.value)} /></label>
        </div>
        <label className={s.field}><span className={s.label}>Session length (minutes)</span>
          <input type="number" min={5} max={240} className={s.input} value={f.minutes} onChange={e => set("minutes", Number(e.target.value))} /></label>
      </div>}
      {step === 2 && <div className={s.card}>
        <label className={s.field} style={{ marginTop: 0 }}><span className={s.label}>Minimum version (on a hard day)</span>
          <input className={s.input} value={f.minimum} maxLength={140} onChange={e => set("minimum", e.target.value)} placeholder="e.g. Read 5 pages" /></label>
        <label className={s.field}><span className={s.label}>If-Then backup</span>
          <input className={s.input} value={f.ifThen} maxLength={200} onChange={e => set("ifThen", e.target.value)} placeholder="If I'm late, then I'll do the minimum version" /></label>
        <label className={s.field}><span className={s.label}>Obstacles (optional)</span>
          <input className={s.input} value={f.obstacles} maxLength={280} onChange={e => set("obstacles", e.target.value)} /></label>
        <span className={s.label} style={{ marginTop: 10 }}>Evidence</span>
        <div className={s.segs}>{EVIDENCE.map(e => <button key={e.id} className={`${s.seg} ${f.evidence === e.id ? s.segOn : ""}`} onClick={() => set("evidence", e.id)}>{e.label}</button>)}</div>
      </div>}
      {step === 3 && <div className={s.card}>
        <span className={s.label}>Partner</span>
        {hasPartner ? <div className={s.segs}>
          <button className={`${s.seg} ${!f.solo ? s.segOn : ""}`} onClick={() => set("solo", false)}>With my partner</button>
          <button className={`${s.seg} ${f.solo ? s.segOn : ""}`} onClick={() => set("solo", true)}>Solo</button>
        </div> : <div className={s.muted}>Solo pact — you confirm your own proof.</div>}
        {hasPartner && !f.solo && <><span className={s.label} style={{ marginTop: 10 }}>Who can see this pact</span>
          <div className={s.segs}>
            <button className={`${s.seg} ${f.visibility === "partner" ? s.segOn : ""}`} onClick={() => set("visibility", "partner")}>My partner</button>
            <button className={`${s.seg} ${f.visibility === "private" ? s.segOn : ""}`} onClick={() => set("visibility", "private")}>Only me</button>
          </div></>}
        <span className={s.label} style={{ marginTop: 10 }}>Reminder</span>
        <div className={s.segs}>{REMINDER_PREFS.map(r => <button key={r.id} className={`${s.seg} ${f.reminder === r.id ? s.segOn : ""}`} onClick={() => set("reminder", r.id)}>{r.label}</button>)}</div>
        <div className={s.muted} style={{ marginTop: 10 }}>Your partner never sees notes, coins or full history.</div>
      </div>}
      {err && step === 3 && <div role="alert" className={s.muted} style={{ color: "var(--a-warn)", marginBottom: 8 }}>{err}</div>}
      {step < 3
        ? <button className={s.btn} onClick={() => setStep(step + 1)} disabled={step === 1 && f.title.trim().length < 3}>Next</button>
        : <button className={s.btn} onClick={() => void save()} disabled={!!err || busy}>{busy ? "Saving…" : "Save pact"}</button>}
    </div>
  );
}

export function CheckinScreen({ hasPartner, onBack, onDone }: { hasPartner: boolean; onBack: () => void; onDone: () => void }) {
  const day = ymd(new Date());
  const [f, setF] = useState({ action: "", completed: false, needs_help: false, next_step: "" });
  const [loaded, setLoaded] = useState(false);
  const [partner, setPartner] = useState<{ checked_in: boolean; completed: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("acct_checkins").select("action,completed,needs_help,next_step").eq("day", day).maybeSingle();
      if (data) setF({ action: data.action ?? "", completed: data.completed, needs_help: data.needs_help, next_step: data.next_step ?? "" });
      if (hasPartner) { const r = await supabase.rpc("acct_partner_checkin_status"); setPartner((r.data as any) ?? null); }
      setLoaded(true);
    })();
  }, [day, hasPartner]);
  const save = async () => {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("acct_checkins").upsert({ user_id: u.user?.id, day, action: f.action.trim() || null, completed: f.completed, needs_help: f.needs_help, next_step: f.next_step.trim() || null }, { onConflict: "user_id,day" });
    setBusy(false);
    if (error) toast.error("Couldn't save your check-in. Try again."); else { haptic("success"); toast.success("Checked in"); onDone(); }
  };
  const cheer = async (k: "fire" | "clap" | "muscle") => {
    const { data, error } = await supabase.rpc("acct_send_cheer", { _kind: k });
    if (error) toast.error("Couldn't send"); else { haptic("success"); toast.success(data ? "Cheer sent" : "Already sent that one today"); }
  };
  if (!loaded) return <div><SubHeader title="Daily check-in" onBack={onBack} /><div className={s.skel} /><div className={s.skel} /></div>;
  return (
    <div>
      <SubHeader title="Daily check-in" onBack={onBack} right={<span className={s.chip}>30 sec</span>} />
      <div className={s.card}>
        <label className={s.field} style={{ marginTop: 0 }}><span className={s.label}>What is your most important action today?</span>
          <input className={s.input} maxLength={140} value={f.action} onChange={e => setF({ ...f, action: e.target.value })} /></label>
        <span className={s.label} style={{ marginTop: 10 }}>Did you complete your commitment?</span>
        <div className={s.segs}><button className={`${s.seg} ${f.completed ? s.segOn : ""}`} onClick={() => setF({ ...f, completed: true })}>Yes</button><button className={`${s.seg} ${!f.completed ? s.segOn : ""}`} onClick={() => setF({ ...f, completed: false })}>Not yet</button></div>
        <span className={s.label} style={{ marginTop: 10 }}>Do you need help adjusting your plan?</span>
        <div className={s.segs}><button className={`${s.seg} ${f.needs_help ? s.segOn : ""}`} onClick={() => setF({ ...f, needs_help: true })}>Yes</button><button className={`${s.seg} ${!f.needs_help ? s.segOn : ""}`} onClick={() => setF({ ...f, needs_help: false })}>I'm fine</button></div>
        <label className={s.field}><span className={s.label}>What's your next step?</span>
          <input className={s.input} maxLength={140} value={f.next_step} onChange={e => setF({ ...f, next_step: e.target.value })} /></label>
        <div className={s.stack}><button className={s.btn} onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save check-in"}</button></div>
      </div>
      {hasPartner && <div className={s.card}>
        <span className={s.label}>Your partner today</span>
        <div className={s.big} style={{ fontSize: 15 }}>{partner == null ? "—" : partner.checked_in ? (partner.completed ? "Checked in · commitment done" : "Checked in") : "Not checked in yet"}</div>
        <span className={s.label}>Send a cheer</span>
        <div className={s.segs}>{([["fire", "🔥"], ["clap", "👏"], ["muscle", "💪"]] as const).map(([k, e]) => <button key={k} className={s.seg} aria-label={`Cheer ${k}`} onClick={() => void cheer(k)}>{e}</button>)}</div>
      </div>}
    </div>
  );
}

export function GardenScreen({ garden, partnerStage, showTree, onToggleShow, onBack }: { garden: Garden | null; partnerStage: { stage: number; stage_name: string } | null; showTree: boolean; onToggleShow: (v: boolean) => void; onBack: () => void }) {
  return (
    <div>
      <SubHeader title="Focus garden" onBack={onBack} />
      {!garden ? <div className={s.skel} style={{ height: 220 }} /> : <div className={s.card} style={{ textAlign: "center" }}>
        <div style={{ display: "grid", placeItems: "center" }}><Tree stage={garden.stage} width={150} height={165} /></div>
        <div className={s.big}>{garden.stage_name}</div>
        <div className={s.muted}>Score {garden.score}.{garden.due > 0 ? ` ${garden.due} pact${garden.due === 1 ? "" : "s"} due this week.` : " Finish one pact to help it grow."}</div>
        <div className={s.bar}><div className={s.barFill} style={{ width: `${garden.score}%` }} /></div>
        {garden.resting && <div className={s.muted} style={{ marginTop: 8 }}>Your tree is resting. Finish one pact to help it grow.</div>}
        <div className={s.legend}>{STAGE_NAMES.map((n, i) => <div key={n} style={{ fontWeight: garden.stage === i + 1 ? 600 : 400, color: garden.stage === i + 1 ? "var(--a-text)" : undefined }}><Tree stage={i + 1} width={28} />{n}</div>)}</div>
        <div className={s.muted} style={{ marginTop: 10, textAlign: "left" }}>Score uses the last 7 days: 85% pacts done on time (Recovered counts 60%), 15% check-in days, minus 10 for each overdue pact. Coins and achievements are never touched.</div>
      </div>}
      <div className={s.card}>
        <span className={s.label}>Partner's tree</span>
        {partnerStage ? <div className={s.garden}><Tree stage={partnerStage.stage} width={48} /><div className={s.big} style={{ fontSize: 15 }}>{partnerStage.stage_name}</div></div>
          : <div className={s.muted}>Not shared or no partner yet.</div>}
        <label className={s.listRow} style={{ borderBottom: 0, marginTop: 6 }}><span>Show my tree to my partner</span>
          <input type="checkbox" checked={showTree} onChange={e => onToggleShow(e.target.checked)} /></label>
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
