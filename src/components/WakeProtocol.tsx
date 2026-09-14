import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bell, BellOff, BedDouble, Check, ChevronDown, Clock3, MoonStar,
  Play, ShieldCheck, Sparkles, Volume2, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type WakeOption = { time: string; pts: number; tag: string; line: string };
export type WakeTone = { id: string; name: string; url: string };

type Status = "idle" | "saving" | "success" | "already" | "error";
type Section = "sleep" | "reminder" | "evening";

const MILESTONES = [21, 60, 90, 250, 365];

function timeForTier(tier: string) {
  return `${String(Number.parseInt(tier, 10) || 4).padStart(2, "0")}:00`;
}

function nextWindow(tier: string) {
  const target = new Date();
  target.setHours(Number.parseInt(tier, 10) || 4, 0, 0, 0);
  if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
  return target;
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function WakeProtocol({
  options, tones, initialTier, initialTone, initialMode, coins, streak, bestStreak,
  onClose, onTone, onMode, onSave, onCheckIn,
}: {
  options: readonly WakeOption[];
  tones: readonly WakeTone[];
  initialTier?: string;
  initialTone: string;
  initialMode: "math" | "science";
  coins: number;
  streak: number;
  bestStreak: number;
  onClose: () => void;
  onTone: (id: string) => void;
  onMode: (mode: "math" | "science") => void;
  onSave: (option: WakeOption, reminderEnabled: boolean, sleepGoal: string, tone: string, mode: "math" | "science") => Promise<void>;
  onCheckIn: (tier: string) => Promise<number>;
}) {
  const reduceMotion = useReducedMotion();
  const [tier, setTier] = useState(initialTier ?? "4AM");
  const [tone, setTone] = useState(initialTone);
  const [mode, setMode] = useState(initialMode);
  const [open, setOpen] = useState<Section | null>("reminder");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [sleepGoal, setSleepGoal] = useState("20:30");
  const [dayCount, setDayCount] = useState(1);
  const [wakeScore, setWakeScore] = useState(0);
  const [checkedToday, setCheckedToday] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const selected = options.find(option => option.time === tier) ?? options[0];
  const countdown = useMemo(() => nextWindow(tier).getTime() - now, [tier, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const today = new Date().toISOString().slice(0, 10);
      const thirtyAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
      const [{ data: alarm }, { data: sessions }] = await Promise.all([
        supabase.from("alarms").select("time,tone,challenge_type,recovery_enabled,sleep_recommendation").eq("user_id", uid).eq("label", "AXEN Wake Protocol").maybeSingle(),
        supabase.from("alarm_sessions").select("completed_on,status").eq("user_id", uid).gte("completed_on", thirtyAgo).order("completed_on", { ascending: true }),
      ]);
      if (!live) return;
      if (alarm) {
        const hour = Number.parseInt(alarm.time, 10);
        if (hour >= 4 && hour <= 7) setTier(`${hour}AM`);
        setTone(alarm.tone || initialTone);
        setMode(alarm.challenge_type === "science" ? "science" : "math");
        setReminderEnabled(alarm.recovery_enabled);
        setSleepGoal(alarm.sleep_recommendation?.slice(0, 5) || "20:30");
      }
      const completed = (sessions ?? []).filter(session => session.status === "completed" || session.status === "recovered");
      setDayCount(completed.length + (completed.some(session => session.completed_on === today) ? 0 : 1));
      setCheckedToday(completed.some(session => session.completed_on === today));
      setWakeScore(Math.round(Math.min(100, completed.length / 30 * 100)));
    })();
    return () => { live = false; };
  }, [initialTone]);

  const saveSettings = async () => {
    setStatus("saving");
    setError("");
    try {
      onTone(tone);
      onMode(mode);
      await onSave(selected, reminderEnabled, sleepGoal, tone, mode);
      setStatus("idle");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Could not save the protocol.");
    }
  };

  const checkIn = async () => {
    if (status === "saving" || status === "success") return;
    setStatus("saving");
    setError("");
    try {
      onTone(tone);
      onMode(mode);
      await onSave(selected, reminderEnabled, sleepGoal, tone, mode);
      const awarded = await onCheckIn(selected.time);
      setCheckedToday(true);
      setStatus(awarded > 0 ? "success" : "already");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Check-in could not be secured.");
    }
  };

  const section = (id: Section, icon: ReactNode, title: string, summary: string, children: ReactNode) => {
    const expanded = open === id;
    return (
      <section className="wakep__section">
        <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : id)}>
          <span>{icon}</span><div><strong>{title}</strong><small>{summary}</small></div>
          <ChevronDown className={expanded ? "is-open" : ""} size={17} />
        </button>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div className="wakep__section-body" initial={reduceMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }} transition={{ duration: .18 }}>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    );
  };

  return (
    <motion.div className="wakep" role="dialog" aria-modal="true" aria-label="4AM Protocol" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="wakep__stars" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <header className="wakep__header">
        <div><span>4AM PROTOCOL</span><small>Day {String(dayCount).padStart(2, "0")}</small></div>
        <button type="button" onClick={onClose} aria-label="Close 4AM Protocol"><X size={20} /></button>
      </header>

      <main className="wakep__content">
        <section className="wakep__hero">
          <div className="wakep__horizon" aria-hidden="true">
            <motion.i animate={reduceMotion ? undefined : { opacity: [.45, .9, .45], scale: [1, 1.04, 1] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
            <span /><b />
          </div>
          <small>PRE-DAWN CHECK-IN</small>
          <h1>WHEN DID<br />YOU RISE?</h1>
          <p>Select your standard. Earlier hours carry greater reward.</p>
        </section>

        <div className="wakep__tiers" role="radiogroup" aria-label="Wake time">
          {options.map(option => (
            <button key={option.time} type="button" role="radio" aria-checked={tier === option.time} className={tier === option.time ? "is-selected" : ""} onClick={() => setTier(option.time)}>
              <strong>{option.time}</strong><span>+{option.pts} XP</span><small>{option.tag}</small>
            </button>
          ))}
        </div>

        <section className="wakep__countdown">
          <span><Clock3 size={15} /> NEXT CHECK-IN WINDOW</span>
          <strong>{formatCountdown(countdown)}</strong>
          <small>{timeForTier(tier)} · local time</small>
        </section>

        <div className="wakep__metrics" aria-label="Wake metrics">
          <div><strong>{streak}</strong><span>Current<br />Streak</span></div>
          <div><strong>{bestStreak}</strong><span>Best<br />Streak</span></div>
          <div><strong>{wakeScore}%</strong><span>Wake<br />Score</span></div>
          <div><strong>{coins}</strong><span>XP</span></div>
        </div>

        <div className="wakep__sections">
          {section("sleep", <BedDouble size={19} />, "Sleep Goal", sleepGoal, <label className="wakep__field"><span>Target bedtime</span><input type="time" value={sleepGoal} onChange={event => setSleepGoal(event.target.value)} /></label>)}
          {section("reminder", reminderEnabled ? <Bell size={19} /> : <BellOff size={19} />, "Wake Reminder", reminderEnabled ? `${timeForTier(tier)} · On` : "Off", <div className="wakep__reminder"><label><span>Alarm time</span><input type="time" min="04:00" max="07:00" value={timeForTier(tier)} onChange={event => { const hour = Number.parseInt(event.target.value, 10); if (hour >= 4 && hour <= 7) setTier(`${hour}AM`); }} /></label><button type="button" role="switch" aria-checked={reminderEnabled} className={reminderEnabled ? "is-on" : ""} onClick={() => setReminderEnabled(value => !value)}><i /></button></div>)}
          {section("evening", <MoonStar size={19} />, "Evening Plan", `${mode === "math" ? "Math" : "Science"} · ${(tones.find(item => item.id === tone)?.name ?? "Alarm").toLowerCase()}`, <><div className="wakep__mode"><button type="button" className={mode === "math" ? "is-selected" : ""} onClick={() => setMode("math")}>Math</button><button type="button" className={mode === "science" ? "is-selected" : ""} onClick={() => setMode("science")}>Science</button></div><div className="wakep__tones">{tones.map(item => <button type="button" key={item.id} className={tone === item.id ? "is-selected" : ""} onClick={() => { setTone(item.id); onTone(item.id); }}><Volume2 size={15} /><span>{item.name}</span>{tone === item.id ? <Check size={15} /> : <Play size={13} />}</button>)}</div></>)}
        </div>

        <section className="wakep__journey">
          <header><Sparkles size={16} /><span>MILESTONE JOURNEY</span></header>
          <div>{MILESTONES.map((milestone, index) => <span key={milestone} className={streak >= milestone ? "is-reached" : ""}><i>{streak >= milestone ? <Check size={12} /> : index + 1}</i><b>{milestone}</b><small>days</small></span>)}</div>
          <p>Milestones mark consistency—not guaranteed habit-formation dates.</p>
        </section>

        <button type="button" className={`wakep__primary ${status === "success" ? "is-secured" : ""}`} disabled={status === "saving" || status === "success"} onClick={checkIn}>
          {status === "saving" ? "SECURING DAY…" : status === "success" ? <><ShieldCheck size={19} /> DAY SECURED</> : status === "already" || checkedToday ? <><Check size={19} /> ALREADY SECURED</> : "I’M AWAKE"}
        </button>
        <button type="button" className="wakep__save" onClick={saveSettings} disabled={status === "saving"}>Save protocol settings</button>
        {status === "error" && <p className="wakep__error" role="alert">{error}</p>}
      </main>

      <AnimatePresence>{status === "success" && <motion.div className="wakep__pulse" initial={{ opacity: 0, scale: .5 }} animate={{ opacity: [0, .8, 0], scale: [.5, 1.25, 1.7] }} exit={{ opacity: 0 }} transition={{ duration: 1.1 }} aria-hidden="true" />}</AnimatePresence>
    </motion.div>
  );
}