import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bell, BellOff, BedDouble, Check, ChevronDown, Clock3, MoonStar,
  Play, ShieldCheck, Sparkles, Volume2, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { readWakeState, saveWakeSettings } from "@/lib/wake.functions";
import { webAlarmScheduler } from "@/lib/web-alarm-scheduler";
import { WakeReadiness } from "@/components/wake/WakeReadiness";
import { CoinBadge } from "@/components/CoinBadge";
import { wakeReward } from "@/lib/wake-rules";

export type WakeOption = { time: string; pts: number; tag: string; line: string };
export type WakeTone = { id: string; name: string; url: string };

type Status = "idle" | "saving" | "success" | "already" | "error";
type Section = "sleep" | "reminder" | "evening";

const MILESTONES = [21, 60, 90, 250, 365];

function timeForTier(tier: string) {
  return `${String(Number.parseInt(tier, 10) || 4).padStart(2, "0")}:00`;
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
  onClose, onTone, onMode,
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
}) {
  const reduceMotion = useReducedMotion();
  const readState = useServerFn(readWakeState);
  const saveState = useServerFn(saveWakeSettings);
  const navigate = useNavigate();
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
  const [wakeTime, setWakeTime] = useState(timeForTier(initialTier ?? "4AM"));
  const [repeatDaily, setRepeatDaily] = useState(true);
  const [difficulty, setDifficulty] = useState(2);
  const [nextFire, setNextFire] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [ready, setReady] = useState(webAlarmScheduler.ready);
  const [saved, setSaved] = useState(false);

  const countdown = useMemo(() => nextFire ? Date.parse(nextFire) - now : 0, [nextFire, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(webAlarmScheduler.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const state = await readState();
      if (!live) return;
      webAlarmScheduler.synchronize(state);
      setNextFire(state.settings?.next_fire_at ?? null);
      setTimezone(state.timezone);
      setSaved(!!state.settings);
      if (state.settings) {
        setWakeTime(state.settings.time.slice(0, 5));
        setRepeatDaily(state.settings.repeat_daily);
        setDifficulty(state.settings.difficulty);
        setReminderEnabled(state.settings.enabled);
        setSleepGoal(state.settings.sleep_time?.slice(0, 5) ?? "20:30");
        setTone(state.settings.tone);
        setMode(state.settings.mode);
        const hour = Number.parseInt(state.settings.time, 10);
        setTier(hour >= 4 && hour <= 7 ? `${hour}AM` : "");
      }
      const today = state.local_date;
      const thirtyAgo = new Date(Date.parse(`${today}T12:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
      const { data: sessions } = await supabase.from("alarm_sessions").select("completed_on,status").eq("user_id", uid).gte("completed_on", thirtyAgo).order("completed_on", { ascending: true });
      if (!live) return;
      const completed = (sessions ?? []).filter(session => session.status === "completed" || session.status === "recovered");
      setDayCount(completed.length + (completed.some(session => session.completed_on === today) ? 0 : 1));
      setCheckedToday(completed.some(session => session.completed_on === today));
      setWakeScore(Math.round(Math.min(100, completed.length / 30 * 100)));
    })().catch(reason => { if (live) { setError(reason instanceof Error ? reason.message : "Could not load your alarm"); setStatus("error"); } });
    return () => { live = false; };
  }, [initialTone, readState]);

  const saveSettings = async () => {
    setStatus("saving");
    setError("");
    try {
      onTone(tone);
      onMode(mode);
      const state = await saveState({ data: { time: wakeTime, sleep: sleepGoal, tone, mode, enabled: reminderEnabled, repeat: repeatDaily, difficulty } });
      webAlarmScheduler.synchronize(state);
      setNextFire(state.settings?.next_fire_at ?? null);
      setTimezone(state.timezone);
      setSaved(true);
      window.dispatchEvent(new Event("axen:wake-updated"));
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
      const state = await readState();
      if (state.event?.status !== "ringing") throw new Error("Your alarm must ring first. Use Test alarm to check the solve flow without rewards.");
      await navigate({ to: "/alarm" });
      setStatus("idle");
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
            <button key={option.time} type="button" role="radio" aria-checked={tier === option.time} className={tier === option.time ? "is-selected" : ""} onClick={() => { setTier(option.time); setWakeTime(timeForTier(option.time)); setSaved(false); }}>
              <strong>{option.time}</strong><span>+{option.pts} XP</span><small>{option.tag}</small>
            </button>
          ))}
        </div>

        <section className="wakep__countdown">
          <span><Clock3 size={15} /> NEXT CHECK-IN WINDOW</span>
          <strong>{nextFire ? formatCountdown(countdown) : "—:—:—"}</strong>
          <small>{nextFire ? `${wakeTime} · ${timezone}` : "No saved alarm"} · {saved ? reminderEnabled ? ready ? "Overnight ready" : "Saved · start Overnight Mode" : "Off" : "Unsaved changes"}</small>
          <CoinBadge amount={wakeReward(wakeTime)} variant="amount" state={wakeReward(wakeTime) ? "available" : "disabled"} />
        </section>

        <div className="wakep__metrics" aria-label="Wake metrics">
          <div><strong>{streak}</strong><span>Current<br />Streak</span></div>
          <div><strong>{bestStreak}</strong><span>Best<br />Streak</span></div>
          <div><strong>{wakeScore}%</strong><span>Wake<br />Score</span></div>
          <div><strong>{coins}</strong><span>XP</span></div>
        </div>

        <div className="wakep__sections">
          {section("sleep", <BedDouble size={19} />, "Sleep Goal", sleepGoal, <label className="wakep__field"><span>Target bedtime</span><input type="time" value={sleepGoal} onChange={event => { setSleepGoal(event.target.value); setSaved(false); }} /></label>)}
          {section("reminder", reminderEnabled ? <Bell size={19} /> : <BellOff size={19} />, "Wake Reminder", reminderEnabled ? `${wakeTime} · On` : "Off", <><div className="wakep__reminder"><label><span>Alarm time</span><input type="time" value={wakeTime} onChange={event => { setWakeTime(event.target.value); const hour = Number.parseInt(event.target.value, 10); setTier(hour >= 4 && hour <= 7 ? `${hour}AM` : ""); setSaved(false); }} /></label><button type="button" role="switch" aria-label="Alarm enabled" aria-checked={reminderEnabled} className={reminderEnabled ? "is-on" : ""} onClick={() => { setReminderEnabled(value => !value); setSaved(false); }}><i /></button></div><label className="wakep__field"><span>Repeat daily</span><input type="checkbox" checked={repeatDaily} onChange={event => { setRepeatDaily(event.target.checked); setSaved(false); }} /></label></>)}
          {section("evening", <MoonStar size={19} />, "Evening Plan", `${mode === "math" ? "Math" : "Science"} · ${(tones.find(item => item.id === tone)?.name ?? "Alarm").toLowerCase()}`, <><div className="wakep__mode"><button type="button" className={mode === "math" ? "is-selected" : ""} onClick={() => setMode("math")}>Math</button><button type="button" className={mode === "science" ? "is-selected" : ""} onClick={() => setMode("science")}>Science</button></div><div className="wakep__tones">{tones.map(item => <button type="button" key={item.id} className={tone === item.id ? "is-selected" : ""} onClick={() => { setTone(item.id); onTone(item.id); }}><Volume2 size={15} /><span>{item.name}</span>{tone === item.id ? <Check size={15} /> : <Play size={13} />}</button>)}</div></>)}
        </div>

        {mode === "math" && <label className="wakep__field"><span>Math difficulty</span><select value={difficulty} onChange={e => setDifficulty(Number(e.target.value))}><option value={1}>Easy</option><option value={2}>Medium</option><option value={3}>Hard</option></select></label>}
        <WakeReadiness onReady={setReady} />

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