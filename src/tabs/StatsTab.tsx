import { useState } from "react";
import { AX, cardStyle, titleStyle } from "./styles";

export type LifeStats = {
  bestStreak: number;
  lifetimeCoins: number;
  heat: { date: string; count: number }[];
  topTask: { icon: string; name: string; count: number } | null;
  medMinutes: number;
  taskTotal?: number;
};

export const zoneColor = (pct: number) => (pct >= 100 ? AX.success : pct >= 50 ? AX.flame : AX.danger);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function Segmented({ active, onChange, tabs }: { active: string; onChange: (id: string) => void; tabs: { id: string; label: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            flex: 1, padding: "10px 8px", borderRadius: 12, cursor: "pointer",
            background: on ? AX.accent : "#181820",
            border: `1px solid ${on ? AX.accent : AX.border}`,
            color: on ? "#FFFFFF" : AX.muted,
            fontFamily: AX.font, fontSize: 13, fontWeight: 600,
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

function Calendar() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.getDate();
  const first = new Date(y, m, 1).getDay();
  const lead = (first + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div>
      <div style={{ ...titleStyle }}>{MONTHS[m]} {y}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 12, color: AX.muted }}>{d}</div>
        ))}
        {cells.map((d, i) => (
          <div key={i} style={{
            aspectRatio: "1 / 1", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, borderRadius: 10,
            color: d ? (d === today ? "#FFFFFF" : AX.text) : "transparent",
            background: d === today ? AX.accent : d ? "#181820" : "transparent",
            border: d ? `1px solid ${d === today ? AX.accent : AX.border}` : "none",
          }}>{d ?? ""}</div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ padding: "14px 12px", borderRadius: 14, background: "#181820", border: `1px solid ${AX.border}` }}>
      <div style={{ fontSize: 12, color: AX.muted }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: AX.text, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: AX.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function StatsTab({ weekly, life }: {
  weekly: number[];
  life?: LifeStats;
}) {
  const CARD = cardStyle();
  const total = Math.max(1, life?.taskTotal || 1);
  const [tab, setTab] = useState("progress");

  return (
    <>
      <div style={{ padding: "4px 2px 16px" }}>
        <div style={{ fontSize: 24, fontWeight: 600, color: AX.text }}>Stats</div>
        <div style={{ fontSize: 14, color: AX.muted, marginTop: 2 }}>Your progress and where you stand.</div>
      </div>

      <Segmented active={tab} onChange={setTab} tabs={[
        { id: "progress", label: "Progress" },
        { id: "calendar", label: "Calendar" },
      ]} />

      {tab === "progress" && (
        <>
          {life && (
            <div style={CARD}>
              <div style={titleStyle}>All time</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                <Metric label="Best streak" value={`${life.bestStreak}`} sub="days" />
                <Metric label="Lifetime" value={`${life.lifetimeCoins}`} sub="coins" />
                <Metric label="Meditation" value={`${life.medMinutes}m`} sub="stillness" />
              </div>
              {life.topTask && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, padding: "12px 14px", borderRadius: 14, background: "#181820", border: `1px solid ${AX.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: AX.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{life.topTask.name}</div>
                    <div style={{ fontSize: 12, color: AX.muted, marginTop: 2 }}>Most completed habit</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: AX.accent }}>{life.topTask.count}×</div>
                </div>
              )}
            </div>
          )}

          <div style={CARD}>
            <div style={titleStyle}>This week</div>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"].map((d, i) => {
              const v = weekly[i] ?? 0;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 44, fontSize: 12, color: AX.muted }}>{d}</div>
                  <div style={{ flex: 1, height: 6, background: "#1D1D28", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${v}%`, background: v >= 100 ? AX.success : AX.accent }} />
                  </div>
                  <div style={{ width: 36, fontSize: 12, color: AX.muted, textAlign: "right" }}>{v}%</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "calendar" && (
        <>
          <div style={CARD}><Calendar /></div>
          {life && (
            <div style={CARD}>
              <div style={titleStyle}>Last 30 days</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 5 }}>
                {life.heat.map(h => {
                  const pct = Math.min(100, Math.round((h.count / total) * 100));
                  const c = zoneColor(pct);
                  return (
                    <div key={h.date} title={`${h.date} · ${h.count}/${total} habits`} style={{
                      aspectRatio: "1 / 1", borderRadius: 8,
                      background: h.count ? c : "#181820",
                      border: `1px solid ${h.count ? c : AX.border}`,
                    }} />
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 12, color: AX.muted }}>
                {[[AX.success, "All done"], [AX.flame, "Partial"], [AX.danger, "Under half"]].map(([c, l]) => (
                  <span key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 8, background: c }} />{l}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

    </>
  );
}
