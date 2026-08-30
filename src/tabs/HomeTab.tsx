import { useEffect, useRef, useState } from "react";
import { AX, cardStyle, titleStyle } from "./styles";
import { DeepFocus, type FocusTier } from "@/components/DeepFocus";
import { haptic } from "@/lib/haptics";
import { ShieldCard } from "@/components/ShieldCard";
import { RemindersCard, type ReminderTask } from "@/components/RemindersCard";
import { EmptyState } from "@/components/EmptyState";
import {
  AlarmClock, Dumbbell, BookOpen, Salad, Droplets, Moon, Brain,
  Flame, Footprints, PenLine, Circle, Check, Shield, type LucideIcon,
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

export function HomeTab({ name, coins, streak, shields = 0, tasks, tick, onFocusComplete, onBuyShield, reminderTasks = [] }: {
  name: string;
  coins: number; streak: number; shields?: number;
  tasks: Task[];
  tick: (id: number) => void;
  onFocusComplete: (tier: FocusTier, lockMode: "strict" | "flex", apps: string[]) => Promise<number | null>;
  onBuyShield?: () => Promise<void>;
  reminderTasks?: ReminderTask[];
}) {
  const CARD = cardStyle();
  const done = tasks.filter(t => t.done).length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const streakShown = useCountUp(streak);
  const [popped, setPopped] = useState<number | null>(null);
  const pending = useRef<Set<number>>(new Set());

  const handleTick = (t: Task) => {
    if (t.done || pending.current.has(t.id)) return; // guard rapid double taps
    pending.current.add(t.id);
    haptic("success");
    setPopped(t.id);
    setTimeout(() => setPopped(p => (p === t.id ? null : p)), 200);
    Promise.resolve(tick(t.id)).finally(() => { pending.current.delete(t.id); });
  };

  return (
    <>
      <style>{`
        .ax-check { transition: transform 150ms ease, background 150ms ease, border-color 150ms ease; }
        .ax-check--pop { transform: scale(1.25); }
        .ax-task { transition: border-color .15s ease, background .15s ease; }
        .ax-task:active { background: #191922; }
      `}</style>

      <div style={{ padding: "4px 2px 16px" }}>
        <div style={{ fontSize: 14, color: AX.muted }}>{greeting()},</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: AX.text, marginTop: 2 }}>{name}</div>
      </div>

      <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: "#1D1D28", border: `1px solid ${AX.border}`,
          display: "flex", alignItems: "center", justifyContent: "center", color: AX.flame,
        }}>
          <Flame size={24} strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: AX.text, lineHeight: 1.1 }}>
            {streakShown} <span style={{ fontSize: 15, color: AX.muted, fontWeight: 500 }}>day streak</span>
          </div>
          <div style={{ fontSize: 13, color: AX.muted, marginTop: 4 }}>{coins} coins earned</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: pct === 100 ? AX.success : AX.text }}>{pct}%</div>
          <div style={{ fontSize: 12, color: AX.muted }}>{done}/{tasks.length} today</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 6, fontSize: 12, color: shields > 0 ? AX.success : AX.muted }}>
            <Shield size={13} strokeWidth={1.9} />{shields}
          </div>
        </div>
      </div>

      <div style={CARD}>
        <div style={titleStyle}>Today's habits</div>

        <div style={{ height: 4, background: "#1D1D28", borderRadius: 4, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? AX.success : AX.accent, transition: "width .4s ease" }} />
        </div>

        {tasks.length === 0 && (
          <EmptyState
            title="No habits loaded yet"
            line="Your five starter habits appear here as soon as your profile finishes syncing."
          />
        )}

        {tasks.map(t => {
          const Ico = taskIcon(t.name);
          return (
            <div key={t.id} className="ax-task" onClick={() => handleTick(t)} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "12px 14px",
              background: "#181820",
              border: `1px solid ${AX.border}`,
              borderRadius: 14, marginBottom: 10, cursor: "pointer",
            }}>
              <span style={{ color: t.done ? AX.muted : AX.accent, display: "inline-flex", flexShrink: 0 }}>
                <Ico size={20} strokeWidth={1.8} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15, fontWeight: 500,
                  color: t.done ? AX.muted : AX.text,
                  textDecoration: t.done ? "line-through" : "none",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{t.name}</div>
                <div style={{ fontSize: 12, color: AX.muted, marginTop: 2 }}>+{t.pts} coins</div>
              </div>
              <div className={`ax-check ${popped === t.id ? "ax-check--pop" : ""}`} style={{
                width: 26, height: 26, flexShrink: 0, borderRadius: 9,
                border: `1.5px solid ${t.done ? AX.success : AX.border}`,
                background: t.done ? AX.success : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#0A0A0F",
              }}>{t.done && <Check size={16} strokeWidth={3} />}</div>
            </div>
          );
        })}
      </div>

      <DeepFocus G={AX.accent} G2={AX.accent} onComplete={onFocusComplete} />
    </>
  );
}
