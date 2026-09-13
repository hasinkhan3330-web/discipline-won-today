import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, Bell, BellOff, CalendarDays, Check, ChevronRight, Circle,
  Clock3, Coins, Flame, Medal, Pencil, Plus, Sparkles, Target, Trash2,
} from "lucide-react";

export type ProfileView = "dashboard" | "habits" | "journey" | "achievements" | "goals" | "reminders" | "account";
export type ProfileHabit = {
  uuid: string;
  name: string;
  icon: string;
  pts: number;
  done: boolean;
  frequency?: string;
  durationDays?: number;
  startedOn?: string;
};
export type ProfileLife = {
  bestStreak: number;
  lifetimeCoins: number;
  heat: { date: string; count: number }[];
  topTask: { icon: string; name: string; count: number } | null;
  focusMinutes: number;
  completionCount?: number;
};

type Goal = {
  id: string;
  title: string;
  description: string | null;
  progress: number;
  target_date: string | null;
  completed: boolean;
};

type Reminder = {
  id: string;
  task_id: string | null;
  goal_id: string | null;
  remind_at: string;
  enabled: boolean;
};

const ACHIEVEMENTS = [
  { days: 1, title: "The First Step", copy: "You chose action over intention." },
  { days: 7, title: "Iron Week", copy: "Seven days of deliberate momentum." },
  { days: 21, title: "Neural Forge", copy: "Your discipline is becoming automatic." },
  { days: 60, title: "Steel Spine", copy: "Consistency now carries its own weight." },
  { days: 90, title: "Identity Shift", copy: "You no longer chase discipline. You live it." },
  { days: 180, title: "Unbreakable", copy: "Half a year of proof." },
  { days: 365, title: "Legend", copy: "One full year. The standard is permanent." },
];

function DetailHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <header className="you-detail-header">
      <button type="button" className="you-icon-button" onClick={onBack} aria-label="Back to profile"><ArrowLeft size={19} /></button>
      <div><h1>{title}</h1><p>{subtitle}</p></div>
    </header>
  );
}

function Progress({ value }: { value: number }) {
  return <div className="you-progress"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function HabitsView({ habits, userId, onBack, onComplete, onChanged }: {
  habits: ProfileHabit[]; userId: string | null; onBack: () => void;
  onComplete: (uuid: string) => Promise<void>; onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [duration, setDuration] = useState(21);
  const [points, setPoints] = useState(10);
  const priority = habits.slice(0, 3);
  const saveHabit = async () => {
    if (!userId || !name.trim() || busy) return;
    setBusy(true);
    const nextOrder = habits.length ? habits.length + 1 : 1;
    const { error } = await supabase.from("tasks").insert({
      user_id: userId, name: name.trim(), icon: "◎", pts: points,
      sort_order: nextOrder, frequency, duration_days: duration,
    });
    setBusy(false);
    if (error) return void toast.error("Could not build that habit", { description: error.message });
    setName(""); setOpen(false); await onChanged();
    toast.success("Habit added", { description: "Your 21-day discipline track is ready." });
  };
  return (
    <div className="you-detail animate-fade-in">
      <DetailHeader title="Build Your Discipline" subtitle="Your daily actions become your identity." onBack={onBack} />
      <section className="you-builder-banner"><Sparkles size={24} /><div><strong>Build your discipline</strong><span>21-Day Habit Builder</span></div></section>
      <h2 className="you-detail-title">Priority habits</h2>
      <div className="you-habit-stack">
        {priority.map((habit, index) => (
          <article className={`you-habit-card ${habit.done ? "is-done" : ""}`} key={habit.uuid}>
            <span className="you-habit-index">0{index + 1}</span>
            <div className="you-habit-copy"><strong>{habit.name}</strong><span>{habit.durationDays ?? 21}-day track · {habit.frequency ?? "daily"}</span><Progress value={habit.done ? 100 : 0} /></div>
            <div className="you-habit-reward"><Coins size={14} />+{habit.pts}</div>
            <button type="button" className="you-check-button" disabled={habit.done} onClick={() => onComplete(habit.uuid)} aria-label={`Complete ${habit.name}`}>
              {habit.done ? <Check size={17} /> : <Circle size={17} />}
            </button>
          </article>
        ))}
      </div>
      {habits.length > 3 && <div className="you-secondary-list">{habits.slice(3).map(habit => <div key={habit.uuid}><span>{habit.name}</span><b>+{habit.pts}</b><button disabled={habit.done} onClick={() => onComplete(habit.uuid)}>{habit.done ? <Check size={15} /> : <ChevronRight size={15} />}</button></div>)}</div>}
      <button type="button" className="you-primary-action" onClick={() => setOpen(value => !value)}><Plus size={18} /> Build Any Habit</button>
      {open && <section className="you-form-panel animate-scale-in">
        <label>Habit name<input value={name} maxLength={80} onChange={event => setName(event.target.value)} placeholder="Read for 20 minutes" /></label>
        <div className="you-form-grid">
          <label>Frequency<select value={frequency} onChange={event => setFrequency(event.target.value)}><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekends">Weekends</option><option value="weekly">Weekly</option></select></label>
          <label>Duration<select value={duration} onChange={event => setDuration(Number(event.target.value))}><option value={21}>21 days</option><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option></select></label>
        </div>
        <label>Reward <input type="range" min="5" max="25" step="5" value={points} onChange={event => setPoints(Number(event.target.value))} /><span className="you-range-value">{points} coins</span></label>
        <button className="you-save-button" disabled={busy || !name.trim()} onClick={saveHabit}>{busy ? "Saving…" : "Start habit"}</button>
      </section>}
    </div>
  );
}

export function JourneyView({ life, streak, onBack }: { life?: ProfileLife; streak: number; onBack: () => void }) {
  const activeDates = (life?.heat ?? []).filter(day => day.count > 0).slice(-8).reverse();
  return <div className="you-detail animate-fade-in">
    <DetailHeader title="My Journey" subtitle="Every completed action leaves a signal." onBack={onBack} />
    <section className="you-journey-orbit"><div><Flame size={23} /><strong>{streak}</strong><span>day current streak</span></div><p>{life?.completionCount ?? 0} habits completed across your discipline journey.</p></section>
    <div className="you-journey-metrics"><div><b>{life?.bestStreak ?? 0}</b><span>Best streak</span></div><div><b>{life?.lifetimeCoins ?? 0}</b><span>Coins earned</span></div><div><b>{Math.floor((life?.focusMinutes ?? 0) / 60)}h</b><span>Deep focus</span></div></div>
    <h2 className="you-detail-title">Progress timeline</h2>
    <div className="you-timeline">
      {activeDates.length ? activeDates.map((day, index) => <div key={day.date} className="you-timeline-item"><i className={index === 0 ? "is-current" : ""} /><div><strong>{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong><span>{day.count} {day.count === 1 ? "habit" : "habits"} completed</span></div></div>) : <div className="you-empty">Complete your first habit to begin the timeline.</div>}
    </div>
    {life?.topTask && <section className="you-highlight"><Medal size={20} /><div><span>Most consistent habit</span><strong>{life.topTask.name}</strong><small>{life.topTask.count} completions</small></div></section>}
  </div>;
}

export function AchievementsView({ bestStreak, onBack }: { bestStreak: number; onBack: () => void }) {
  return <div className="you-detail animate-fade-in">
    <DetailHeader title="Achievements" subtitle="Milestones forged through repetition." onBack={onBack} />
    <div className="you-achievement-grid">{ACHIEVEMENTS.map(item => {
      const unlocked = bestStreak >= item.days;
      const progress = Math.min(100, bestStreak / item.days * 100);
      return <article key={item.days} className={`you-achievement ${unlocked ? "is-unlocked" : ""}`}><div className="you-achievement-badge"><Medal size={24} /><b>{item.days}</b></div><strong>{item.title}</strong><p>{item.copy}</p><Progress value={progress} /><span>{unlocked ? "Unlocked" : `${bestStreak}/${item.days} days`}</span></article>;
    })}</div>
  </div>;
}

export function GoalsView({ userId, onBack, onChanged }: { userId: string | null; onBack: () => void; onChanged?: () => void }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const load = async () => { const { data } = await supabase.from("goals").select("id,title,description,progress,target_date,completed").order("created_at", { ascending: false }); setGoals(data ?? []); };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!userId || !title.trim()) return;
    const payload = { title: title.trim(), target_date: date || null };
    const result = editing ? await supabase.from("goals").update(payload).eq("id", editing) : await supabase.from("goals").insert({ ...payload, user_id: userId });
    if (result.error) return void toast.error("Could not save that goal", { description: result.error.message });
    setTitle(""); setDate(""); setEditing(null); await load(); onChanged?.();
  };
  const updateProgress = async (goal: Goal, progress: number) => { await supabase.from("goals").update({ progress, completed: progress === 100 }).eq("id", goal.id); await load(); onChanged?.(); };
  const remove = async (id: string) => { await supabase.from("goals").delete().eq("id", id); await load(); onChanged?.(); };
  return <div className="you-detail animate-fade-in">
    <DetailHeader title="Goals" subtitle="Aim clearly. Advance deliberately." onBack={onBack} />
    <section className="you-form-panel you-goal-form"><label>What do you want to achieve?<input value={title} maxLength={120} onChange={event => setTitle(event.target.value)} placeholder="Run my first 10K" /></label><label>Target date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><button className="you-save-button" disabled={!title.trim()} onClick={save}>{editing ? "Update goal" : "Add goal"}</button></section>
    <div className="you-goal-list">{goals.map(goal => <article key={goal.id} className={goal.completed ? "is-complete" : ""}><div className="you-goal-head"><div><strong>{goal.title}</strong><span>{goal.target_date ? `Target ${new Date(`${goal.target_date}T00:00:00`).toLocaleDateString()}` : "No deadline"}</span></div><div><button onClick={() => { setEditing(goal.id); setTitle(goal.title); setDate(goal.target_date ?? ""); }} aria-label={`Edit ${goal.title}`}><Pencil size={15} /></button><button onClick={() => remove(goal.id)} aria-label={`Delete ${goal.title}`}><Trash2 size={15} /></button></div></div><Progress value={goal.progress} /><div className="you-goal-controls"><span>{goal.progress}% complete</span><input aria-label={`Progress for ${goal.title}`} type="range" min="0" max="100" step="5" value={goal.progress} onChange={event => updateProgress(goal, Number(event.target.value))} /></div></article>)}</div>
    {!goals.length && <div className="you-empty">Your first goal begins with a clear finish line.</div>}
  </div>;
}

export function RemindersView({ habits, userId, onBack }: { habits: ProfileHabit[]; userId: string | null; onBack: () => void }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [rows, setRows] = useState<Reminder[]>([]);
  const [kind, setKind] = useState<"habit" | "goal">("habit");
  const [target, setTarget] = useState("");
  const [time, setTime] = useState("07:00");
  const targets = kind === "habit" ? habits.map(h => ({ id: h.uuid, name: h.name })) : goals.map(g => ({ id: g.id, name: g.title }));
  const names = useMemo(() => new Map([...habits.map(h => [h.uuid, h.name] as const), ...goals.map(g => [g.id, g.title] as const)]), [habits, goals]);
  const load = async () => {
    const [{ data: reminderData }, { data: goalData }] = await Promise.all([
      supabase.from("habit_reminders").select("id,task_id,goal_id,remind_at,enabled").order("remind_at"),
      supabase.from("goals").select("id,title,description,progress,target_date,completed").order("created_at"),
    ]);
    setRows(reminderData ?? []); setGoals(goalData ?? []);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setTarget(targets[0]?.id ?? ""); }, [kind, habits.length, goals.length]);
  const create = async () => {
    if (!userId || !target) return;
    const payload = { user_id: userId, task_id: kind === "habit" ? target : null, goal_id: kind === "goal" ? target : null, remind_at: time, enabled: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" };
    const conflict = kind === "habit" ? "user_id,task_id" : undefined;
    const result = conflict ? await supabase.from("habit_reminders").upsert(payload, { onConflict: conflict }) : await supabase.from("habit_reminders").insert(payload);
    if (result.error) return void toast.error("Could not save reminder", { description: result.error.message });
    await load();
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
  };
  const patch = async (row: Reminder, values: Partial<Reminder>) => { await supabase.from("habit_reminders").update(values).eq("id", row.id); await load(); };
  const remove = async (id: string) => { await supabase.from("habit_reminders").delete().eq("id", id); await load(); };
  return <div className="you-detail animate-fade-in">
    <DetailHeader title="Reminders" subtitle="Keep every promise visible." onBack={onBack} />
    <section className="you-form-panel"><div className="you-segmented"><button className={kind === "habit" ? "is-active" : ""} onClick={() => setKind("habit")}>Habits</button><button className={kind === "goal" ? "is-active" : ""} onClick={() => setKind("goal")}>Goals</button></div><label>Remind me about<select value={target} onChange={event => setTarget(event.target.value)}>{targets.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Time<input type="time" value={time} onChange={event => setTime(event.target.value)} /></label><button className="you-save-button" disabled={!target} onClick={create}><Plus size={16} /> Add reminder</button></section>
    <div className="you-reminder-list">{rows.map(row => { const id = row.task_id ?? row.goal_id ?? ""; return <article key={row.id} className={row.enabled ? "is-active" : ""}><span className="you-reminder-icon">{row.enabled ? <Bell size={18} /> : <BellOff size={18} />}</span><div><strong>{names.get(id) ?? "Reminder"}</strong><span>{row.remind_at.slice(0, 5)}</span></div><input type="time" aria-label={`Change time for ${names.get(id) ?? "reminder"}`} value={row.remind_at.slice(0, 5)} onChange={event => patch(row, { remind_at: event.target.value })} /><button onClick={() => patch(row, { enabled: !row.enabled })} aria-label={row.enabled ? "Disable reminder" : "Enable reminder"}>{row.enabled ? <Check size={16} /> : <Circle size={16} />}</button><button onClick={() => remove(row.id)} aria-label="Delete reminder"><Trash2 size={15} /></button></article>; })}</div>
    {!rows.length && <div className="you-empty">No reminders yet. Add one for a habit or goal.</div>}
  </div>;
}
