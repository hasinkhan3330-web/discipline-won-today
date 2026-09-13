import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AX } from "./styles";
import { DeepFocus, type DeepFocusHandle, type FocusTier } from "@/components/DeepFocus";
import { haptic } from "@/lib/haptics";
import { ShieldCard } from "@/components/ShieldCard";
import { RemindersCard, type ReminderTask } from "@/components/RemindersCard";
import { EmptyState } from "@/components/EmptyState";
import {
  AlarmClock, Dumbbell, BookOpen, Salad, Droplets, Moon, Brain,
  Flame, Footprints, PenLine, Circle, Check, ScanLine, Coins, Zap,
  ChevronRight, Music2, type LucideIcon,
} from "lucide-react";

type Task = { id: number; icon: string; name: string; pts: number; done: boolean };

const ICON_RULES: { k: RegExp; I: LucideIcon }[] = [
  { k: /wake|alarm|4\s?am|morning/i, I: AlarmClock },
  { k: /workout|gym|train|exercise|push/i, I: Dumbbell },
  { k: /focus|read|study|book|learn/i, I: BookOpen },
  { k: /junk|food|diet|eat|sugar/i, I: Salad },
  { k: /shower|cold|water|hydrat/i, I: Droplets },
  { k: /sleep|night|bed/i, I: Moon },
  { k: /meditat|zen|breath|mind/i, I: Brain },
  { k: /walk|run|steps|cardio/i, I: Footprints },
  { k: /journal|write|plan/i, I: PenLine },
  { k: /nofap|streak|disciplin/i, I: Flame },
];

function taskIcon(name: string): LucideIcon {
  return ICON_RULES.find(r => r.k.test(name))?.I ?? Circle;
}

/** Animated count-up for the streak number. */
export function useCountUp(value: number, ms = 600) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(a + (b - a) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return display;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeTab({ name, coins, streak, shields = 0, tasks, tick, onScan, onFocusComplete, onBuyShield, reminderTasks = [] }: {
  name: string;
  coins: number; streak: number; shields?: number;
  tasks: Task[];
  tick: (id: number) => void;
  onScan?: (id: number) => void;
  onFocusComplete: (tier: FocusTier, lockMode: "strict" | "flex", apps: string[]) => Promise<number | null>;
  onBuyShield?: () => Promise<void>;
  reminderTasks?: ReminderTask[];
}) {
  const done = tasks.filter(t => t.done).length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const streakShown = useCountUp(streak);
  const [popped, setPopped] = useState<number | null>(null);
  const pending = useRef<Set<number>>(new Set());
  const focusRef = useRef<DeepFocusHandle>(null);

  const handleTick = (t: Task) => {
    if (t.done || pending.current.has(t.id)) return; // guard rapid double taps
    pending.current.add(t.id);
    haptic("success");
    setPopped(t.id);
    setTimeout(() => setPopped(p => (p === t.id ? null : p)), 200);
    Promise.resolve(tick(t.id)).finally(() => { pending.current.delete(t.id); });
  };

  return (
    <main className="home-command">
      <header className="home-header">
        <div><span>AXEN</span><h1>Command Center</h1><p>{greeting()}, {name}</p></div>
        <div className="home-coin-pill"><Coins size={17} strokeWidth={1.8} /><strong>{coins}</strong><span>coins</span></div>
      </header>

      <section className="home-discipline-panel">
        <div className="home-discipline-panel__top">
          <div><span>Today’s Discipline</span><strong>{pct}<small>%</small></strong><p>{done} of {tasks.length} missions complete</p></div>
          <div className="home-discipline-ring" style={{ "--home-progress": `${pct * 3.6}deg` } as CSSProperties}><Zap size={22} /></div>
        </div>
        <div className="home-discipline-stats">
          <div><Flame size={16} /><span>Current streak</span><strong>{streakShown} days</strong></div>
          <div><Coins size={16} /><span>Today coins</span><strong>{tasks.filter(t => t.done).reduce((sum, t) => sum + t.pts, 0)}</strong></div>
        </div>
        <button className="home-primary-action" onClick={() => focusRef.current?.start()}><Zap size={18} fill="currentColor" /> Start Deep Focus</button>
      </section>

      <section className="home-missions">
        <div className="home-section-heading home-section-heading--plain"><div><h2>Today Missions</h2><p>Execute the plan. No negotiation.</p></div><span>{done}/{tasks.length}</span></div>
        <div className="home-mission-progress"><i style={{ width: `${pct}%` }} /></div>

        {tasks.length === 0 && (
          <EmptyState
            title="No habits loaded yet"
            line="Your five starter habits appear here as soon as your profile finishes syncing."
          />
        )}

        {tasks.map(t => {
          const Ico = taskIcon(t.name);
          const scannable = !t.done && !!onScan && /workout|gym|train|exercise|shower|bath|cold|focus|study|read/i.test(t.name);
          return (
            <div key={t.id} className={`home-mission ${t.done ? "is-done" : ""}`} onClick={() => handleTick(t)}>
              <span className="home-mission__icon"><Ico size={18} strokeWidth={1.7} /></span>
              <div className="home-mission__copy">
                <strong>{t.name}</strong>
                <span>+{t.pts} coins</span>
              </div>
              {scannable && (
                <button className="home-scan-button" aria-label={`Scan to verify ${t.name}`} onClick={e => { e.stopPropagation(); haptic("tap"); onScan!(t.id); }}>
                  <ScanLine size={16} strokeWidth={1.8} />
                </button>
              )}
              <div className={`home-check ${popped === t.id ? "home-check--pop" : ""}`}>{t.done && <Check size={14} strokeWidth={3} />}</div>
            </div>
          );
        })}
      </section>

      {onBuyShield && <div className="home-command-block"><ShieldCard shields={shields} coins={coins} onBuy={onBuyShield} /></div>}

      {reminderTasks.length > 0 && <div className="home-command-block"><RemindersCard tasks={reminderTasks} /></div>}

      <DeepFocus ref={focusRef} G={AX.cyan} G2={AX.accent} onComplete={onFocusComplete} />

      <button className="home-music-strip" onClick={() => focusRef.current?.openMusic()}>
        <span><Music2 size={18} /></span><div><strong>Focus Music</strong><small>30:00 · 14Hz Beta · Study Melody</small></div><ChevronRight size={17} />
      </button>
    </main>
  );
}
