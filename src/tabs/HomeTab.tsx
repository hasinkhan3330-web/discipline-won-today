import { cardStyle, titleStyle } from "./styles";
import { DeepFocus, type FocusTier } from "@/components/DeepFocus";

type Task = { id: number; icon: string; name: string; pts: number; done: boolean };

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
        {tasks.map(t => (
          <div key={t.id} onClick={() => tick(t.id)} style={{
            display: "flex", alignItems: "center", gap: 9, padding: "8px 9px",
            background: t.done ? "rgba(0,0,0,0.3)" : `linear-gradient(90deg, ${G}12, transparent)`,
            border: `1px solid ${t.done ? "#222" : G + "33"}`,
            borderLeft: `3px solid ${t.done ? "#333" : G}`,
            marginBottom: 5, cursor: "pointer", opacity: t.done ? 0.45 : 1,
            transition: "all 0.2s", borderRadius: 2,
          }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e8e8e8", textDecoration: t.done ? "line-through" : "none", letterSpacing: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
              <div style={{ fontSize: 8.5, color: G, letterSpacing: 1, marginTop: 1 }}>+{t.pts} COINS</div>
            </div>
            <div style={{ width: 19, height: 19, flexShrink: 0, border: `1.5px solid ${t.done ? G : "#333"}`, background: t.done ? G : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#000", fontWeight: 900, boxShadow: t.done ? `0 0 10px ${G}` : "none" }}>{t.done ? "✓" : ""}</div>
          </div>
        ))}
      </div>

      <DeepFocus G={G} G2={G2} onComplete={onFocusComplete} />
    </>
  );
}
