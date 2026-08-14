import { cardStyle, titleStyle } from "./styles";
import { DeepFocus, type FocusTier } from "@/components/DeepFocus";
import {
  AlarmClock, Dumbbell, BookOpen, Salad, Droplets, Moon, Brain,
  Flame, Footprints, PenLine, Sparkles, Check, type LucideIcon,
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
  return ICON_RULES.find(r => r.k.test(name))?.I ?? Sparkles;
}

export function HomeTab({ G, G2, coins, streak, tasks, tick, onFocusComplete }: {
  G: string; G2: string;
  coins: number; streak: number;
  tasks: Task[];
  tick: (id: number) => void;
  onFocusComplete: (tier: FocusTier, lockMode: "strict" | "flex", apps: string[]) => Promise<number | null>;
}) {

  const CARD = cardStyle(G);
  const TITLE = titleStyle;
  const done = tasks.filter(t => t.done).length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  return (
    <>
      <div style={{ ...CARD, padding: 12, marginBottom: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginBottom: 9 }}>
          {[{ v: coins, l: "COINS" }, { v: `${streak}d`, l: "STREAK" }, { v: `${done}/${tasks.length}`, l: "TASKS" }, { v: `${pct}%`, l: "DONE" }].map((s, i) => (
            <div key={i} style={{ background: `linear-gradient(135deg, ${G}15, transparent)`, border: `1px solid ${G}33`, padding: "8px 4px", textAlign: "center", position: "relative", overflow: "hidden", borderRadius: 2 }}>
              <div style={{ position: "absolute", top: 0, right: 0, width: 12, height: 12, borderTop: `1px solid ${G}`, borderRight: `1px solid ${G}` }} />
              <div style={{ fontSize: 15, fontWeight: 800, color: G, textShadow: `0 0 12px ${G}88` }}>{s.v}</div>
              <div style={{ fontSize: 7.5, color: "#888", letterSpacing: 1.4, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 8.5, color: "#888", letterSpacing: 1.6, flexShrink: 0 }}>MISSION</div>
          <div style={{ flex: 1, height: 5, background: "#0a0a15", borderRadius: 3, border: `1px solid ${G}22`, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${G},${G2})`, boxShadow: `0 0 10px ${G}`, transition: "width 0.5s" }} />
          </div>
          <div style={{ fontSize: 9, color: G, fontWeight: 800, flexShrink: 0 }}>{pct}%</div>
        </div>
      </div>

      <div style={{ ...CARD, padding: 12, marginBottom: 8 }}>
        <div style={{ ...TITLE, marginBottom: 8 }}><span style={{ color: G }}>▸</span> TODAY'S <span style={{ color: G }}>MISSION</span></div>
        <style>{`
          .lux-task { position: relative; overflow: hidden; }
          .lux-task:hover { transform: translateX(2px); }
          .lux-task:active { transform: scale(0.985); }
          .lux-task:hover .lux-task__sigil { box-shadow: 0 0 18px ${G}66, inset 0 1px 0 ${G}44; transform: translateY(-1px); }
          .lux-task__sigil { transition: all .25s ease; }
          .lux-task__box { transition: all .25s cubic-bezier(.34,1.56,.64,1); }
          .lux-task:hover .lux-task__box { border-color: ${G}; box-shadow: 0 0 14px ${G}55; }
        `}</style>
        {tasks.map(t => {
          const Ico = taskIcon(t.name);
          return (
            <div key={t.id} className="lux-task" onClick={() => tick(t.id)} style={{
              display: "flex", alignItems: "center", gap: 11, padding: "9px 10px",
              background: t.done
                ? "linear-gradient(90deg, rgba(255,255,255,0.03), transparent)"
                : `linear-gradient(100deg, ${G}18, ${G2}0a 45%, transparent)`,
              border: `1px solid ${t.done ? "#1e1e28" : G + "3a"}`,
              borderLeft: `3px solid ${t.done ? "#2a2a35" : G}`,
              marginBottom: 6, cursor: "pointer", opacity: t.done ? 0.5 : 1,
              transition: "all 0.25s ease", borderRadius: 4,
              boxShadow: t.done ? "none" : `inset 0 1px 0 ${G}18, 0 2px 10px rgba(0,0,0,0.45)`,
            }}>
              <span className="lux-task__sigil" style={{
                width: 34, height: 34, flexShrink: 0, borderRadius: 9,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: t.done ? "rgba(255,255,255,0.04)" : `linear-gradient(140deg, ${G}30, ${G2}14)`,
                border: `1px solid ${t.done ? "#2a2a35" : G + "55"}`,
                boxShadow: t.done ? "none" : `inset 0 1px 0 ${G}33, 0 0 12px ${G}22`,
                color: t.done ? "#5a5a6e" : G,
              }}>
                <Ico size={17} strokeWidth={1.9} style={{ filter: t.done ? "none" : `drop-shadow(0 0 5px ${G}aa)` }} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.done ? "#8a8a99" : "#f2f2f5", textDecoration: t.done ? "line-through" : "none", letterSpacing: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                <div style={{ fontSize: 8.5, color: G, letterSpacing: 1.3, marginTop: 2, fontWeight: 700, opacity: 0.9 }}>+{t.pts} COINS</div>
              </div>
              <div className="lux-task__box" style={{
                width: 22, height: 22, flexShrink: 0, borderRadius: 6,
                border: `1.5px solid ${t.done ? G : "#3a3a48"}`,
                background: t.done ? `linear-gradient(140deg, ${G}, ${G2})` : "rgba(0,0,0,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#05050c", boxShadow: t.done ? `0 0 14px ${G}aa, inset 0 1px 0 rgba(255,255,255,0.35)` : "inset 0 1px 0 rgba(255,255,255,0.05)",
              }}>{t.done && <Check size={14} strokeWidth={3.2} />}</div>
            </div>
          );
        })}
      </div>

      <DeepFocus G={G} G2={G2} onComplete={onFocusComplete} />
    </>
  );
}
