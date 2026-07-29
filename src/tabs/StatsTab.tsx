import { cardStyle, titleStyle } from "./styles";

export type LifeStats = {
  bestStreak: number;
  lifetimeCoins: number;
  heat: { date: string; count: number }[];
  topTask: { icon: string; name: string; count: number } | null;
  medMinutes: number;
};

function Metric({ G, label, value, sub }: { G: string; label: string; value: string; sub?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 120, padding: "12px 10px", borderRadius: 2,
      background: "rgba(0,0,0,0.35)", border: `1px solid ${G}22`, borderLeft: `2px solid ${G}`,
    }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: "#777", fontFamily: "monospace" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: G, textShadow: `0 0 12px ${G}66`, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#888", letterSpacing: 1, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function StatsTab({ G, G2, weekly, life }: { G: string; G2: string; weekly: number[]; life?: LifeStats }) {
  const CARD = cardStyle(G);
  const maxHeat = Math.max(1, ...(life?.heat || []).map(h => h.count));

  return (
    <>
      {life && (
        <>
          <div style={CARD}>
            <div style={titleStyle}><span style={{ color: G }}>▸</span> ALL <span style={{ color: G }}>TIME</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Metric G={G} label="BEST STREAK" value={`🔥 ${life.bestStreak}`} sub="DAYS UNBROKEN" />
              <Metric G={G} label="LIFETIME COINS" value={`${life.lifetimeCoins}`} sub="TOTAL EARNED" />
              <Metric G={G} label="MEDITATION" value={`${life.medMinutes}m`} sub="TOTAL STILLNESS" />
            </div>
          </div>

          <div style={CARD}>
            <div style={titleStyle}><span style={{ color: G }}>▸</span> 30 DAY <span style={{ color: G }}>HEATMAP</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 5 }}>
              {life.heat.map(h => {
                const r = h.count / maxHeat;
                return (
                  <div
                    key={h.date}
                    title={`${h.date} · ${h.count} task${h.count === 1 ? "" : "s"}`}
                    style={{
                      aspectRatio: "1 / 1", borderRadius: 2,
                      background: h.count ? `linear-gradient(135deg,${G},${G2})` : "#0a0a15",
                      opacity: h.count ? 0.35 + r * 0.65 : 1,
                      border: `1px solid ${G}${h.count ? "88" : "22"}`,
                      boxShadow: h.count ? `0 0 6px ${G}55` : "none",
                    }}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#666", letterSpacing: 2, marginTop: 8 }}>
              <span>30 DAYS AGO</span><span>TODAY</span>
            </div>
          </div>

          {life.topTask && (
            <div style={CARD}>
              <div style={titleStyle}><span style={{ color: G }}>▸</span> MOST <span style={{ color: G }}>CONQUERED</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 30 }}>{life.topTask.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#eee", letterSpacing: 2 }}>{life.topTask.name.toUpperCase()}</div>
                  <div style={{ fontSize: 10, color: "#777", letterSpacing: 1.5, marginTop: 2 }}>COMPLETED ALL TIME</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: G, textShadow: `0 0 12px ${G}66` }}>{life.topTask.count}×</div>
              </div>
            </div>
          )}
        </>
      )}

      <div style={CARD}>
        <div style={titleStyle}><span style={{ color: G }}>▸</span> WEEKLY <span style={{ color: G }}>PROGRESS</span></div>
        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "TDY"].map((d, i) => {
          const v = weekly[i] ?? 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 34, fontSize: 10, color: "#666", letterSpacing: 2 }}>{d}</div>
              <div style={{ flex: 1, height: 8, background: "#0a0a15", borderRadius: 4, border: `1px solid ${G}22`, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${v}%`, background: `linear-gradient(90deg,${G},${G2})`, boxShadow: `0 0 8px ${G}` }} />
              </div>
              <div style={{ width: 32, fontSize: 11, color: G, textAlign: "right", fontWeight: 700 }}>{v}%</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
