import { cardStyle, titleStyle } from "./styles";

export function StatsTab({ G, G2, weekly }: { G: string; G2: string; weekly: number[] }) {
  const CARD = cardStyle(G);
  return (
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
  );
}
