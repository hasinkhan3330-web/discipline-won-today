import { useState } from "react";
import { cardStyle, titleStyle } from "./styles";
import { SubTabs } from "@/components/Collapse";

export type LifeStats = {
  bestStreak: number;
  lifetimeCoins: number;
  heat: { date: string; count: number }[];
  topTask: { icon: string; name: string; count: number } | null;
  medMinutes: number;
  taskTotal?: number;
};

/** 100% = green, 50%+ = yellow, below = red */
export const zoneColor = (pct: number) => (pct >= 100 ? "#00ff88" : pct >= 50 ? "#ffcc33" : "#ff3b5c");

const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

function Calendar({ G }: { G: string }) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.getDate();
  const first = new Date(y, m, 1).getDay(); // 0 = Sun
  const lead = (first + 6) % 7; // week starts Monday
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#fff", letterSpacing: 2.5 }}>{MONTHS[m]} {y}</div>
        <div style={{ fontSize: 9, letterSpacing: 1.5, color: G }}>{String(today).padStart(2, "0")}/{String(m + 1).padStart(2, "0")}/{y}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 8, letterSpacing: 1, color: "#666" }}>{d}</div>
        ))}
        {cells.map((d, i) => (
          <div key={i} style={{
            aspectRatio: "1 / 1", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: d === today ? 900 : 600, borderRadius: 2,
            color: d ? (d === today ? "#000" : "#bbb") : "transparent",
            background: d === today ? G : d ? "rgba(0,0,0,0.35)" : "transparent",
            border: d ? `1px solid ${d === today ? G : G + "1a"}` : "none",
            boxShadow: d === today ? `0 0 14px ${G}` : "none",
          }}>{d ?? ""}</div>
        ))}
      </div>
    </div>
  );
}


function Metric({ G, label, value, sub }: { G: string; label: string; value: string; sub?: string }) {
  return (
    <div style={{
      padding: "10px 8px", borderRadius: 2,
      background: "rgba(0,0,0,0.35)", border: `1px solid ${G}22`, borderLeft: `2px solid ${G}`,
    }}>
      <div style={{ fontSize: 8, letterSpacing: 1.4, color: "#777", fontFamily: "monospace" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 900, color: G, textShadow: `0 0 12px ${G}66`, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 7.5, color: "#888", letterSpacing: 1, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

export function StatsTab({ G, G2, weekly, life }: { G: string; G2: string; weekly: number[]; life?: LifeStats }) {
  const CARD = cardStyle(G);
  const total = Math.max(1, life?.taskTotal || 1);
  const [tab, setTab] = useState("progress");

  return (
    <>
      <SubTabs G={G} active={tab} onChange={setTab} tabs={[
        { id: "progress", label: "PROGRESS" },
        { id: "cal", label: "CALENDAR" },
      ]} />

      {tab === "progress" && (
        <>
          {life && (
            <div style={{ ...CARD, padding: 12, marginBottom: 8 }}>
              <div style={{ ...titleStyle, marginBottom: 8 }}><span style={{ color: G }}>▸</span> ALL <span style={{ color: G }}>TIME</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                <Metric G={G} label="BEST STREAK" value={`🔥${life.bestStreak}`} sub="DAYS" />
                <Metric G={G} label="LIFETIME" value={`${life.lifetimeCoins}`} sub="COINS" />
                <Metric G={G} label="MEDITATION" value={`${life.medMinutes}m`} sub="STILLNESS" />
              </div>
              {life.topTask && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, padding: "8px 10px", borderRadius: 2, background: "rgba(0,0,0,0.35)", border: `1px solid ${G}22`, borderLeft: `2px solid ${G}` }}>
                  <div style={{ fontSize: 20 }}>{life.topTask.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#eee", letterSpacing: 1.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{life.topTask.name.toUpperCase()}</div>
                    <div style={{ fontSize: 8, color: "#777", letterSpacing: 1.2, marginTop: 1 }}>MOST CONQUERED</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: G, textShadow: `0 0 12px ${G}66` }}>{life.topTask.count}×</div>
                </div>
              )}
            </div>
          )}

          <div style={{ ...CARD, padding: 12 }}>
            <div style={{ ...titleStyle, marginBottom: 8 }}><span style={{ color: G }}>▸</span> WEEKLY <span style={{ color: G }}>PROGRESS</span></div>
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "TDY"].map((d, i) => {
              const v = weekly[i] ?? 0;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  <div style={{ width: 30, fontSize: 8.5, color: "#666", letterSpacing: 1.5 }}>{d}</div>
                  <div style={{ flex: 1, height: 6, background: "#0a0a15", borderRadius: 4, border: `1px solid ${G}22`, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${v}%`, background: `linear-gradient(90deg,${G},${G2})`, boxShadow: `0 0 8px ${G}` }} />
                  </div>
                  <div style={{ width: 28, fontSize: 9.5, color: G, textAlign: "right", fontWeight: 700 }}>{v}%</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "cal" && life && (
        <>
          <div style={{ ...CARD, padding: 12, marginBottom: 8 }}>
            <Calendar G={G} />
          </div>

          <div style={{ ...CARD, padding: 12 }}>
            <div style={{ ...titleStyle, marginBottom: 8 }}><span style={{ color: G }}>▸</span> 30 DAY <span style={{ color: G }}>HEATMAP</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
              {life.heat.map(h => {
                const pct = Math.min(100, Math.round((h.count / total) * 100));
                const c = zoneColor(pct);
                const dayNum = Number(h.date.slice(8, 10));
                return (
                  <div
                    key={h.date}
                    title={`${h.date} · ${h.count}/${total} tasks · ${pct}%`}
                    style={{
                      aspectRatio: "1 / 1", borderRadius: 2,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 8, fontWeight: 900,
                      color: h.count ? "#04040a" : "#3a3a4a",
                      background: h.count ? `linear-gradient(135deg, ${c}, ${c}aa)` : "#0a0a15",
                      border: `1px solid ${h.count ? c : G + "22"}`,
                      boxShadow: h.count ? `0 0 ${pct >= 100 ? 14 : 8}px ${c}${pct >= 100 ? "cc" : "77"}, inset 0 0 8px ${c}55` : "none",
                      animation: h.count ? "cell-glow 2.6s ease-in-out infinite" : "none",
                    }}
                  >{dayNum}</div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 8, color: "#777", letterSpacing: 1.2, marginTop: 8 }}>
              {[["#00ff88", "100%"], ["#ffcc33", "50–99%"], ["#ff3b5c", "UNDER 50%"]].map(([c, l]) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c, boxShadow: `0 0 8px ${c}` }} />{l}
                </span>
              ))}
              <span style={{ marginLeft: "auto", color: "#666" }}>30D AGO → TODAY</span>
            </div>
          </div>
        </>
      )}

      {tab === "cal" && !life && (
        <div style={{ ...CARD, padding: 14, fontSize: 10, color: "#777", letterSpacing: 1.5 }}>◌ LOADING…</div>
      )}
    </>
  );
}
