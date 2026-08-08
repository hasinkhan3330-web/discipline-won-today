import { cardStyle, titleStyle } from "./styles";

type BoardEntry = { n: string; c: number; s: number; img: string; you?: boolean };

export function RankTab({ G, board, fallbackAvatar }: {
  G: string;
  board: BoardEntry[];
  fallbackAvatar: (n: string) => string;
}) {
  const CARD = cardStyle(G);
  const podium = board.slice(0, 3);
  const rest = board.slice(3);
  return (
    <div style={{ ...CARD, padding: 12 }}>
      <div style={{ ...titleStyle, marginBottom: 8 }}><span style={{ color: G }}>▸</span> GLOBAL <span style={{ color: G }}>LEADERBOARD</span></div>
      {board.length === 0 && <div style={{ fontSize: 10, color: "#666", textAlign: "center", padding: 16, letterSpacing: 2 }}>LOADING…</div>}

      {podium.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
          {podium.map((u, i) => (
            <div key={i} style={{
              textAlign: "center", padding: "10px 4px", borderRadius: 2,
              background: u.you ? `linear-gradient(180deg, ${G}22, transparent)` : "rgba(0,0,0,0.35)",
              border: `1px solid ${u.you ? G + "66" : G + "22"}`,
            }}>
              <div style={{ fontSize: 14 }}>{["🥇", "🥈", "🥉"][i]}</div>
              <img src={u.img} onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackAvatar(u.n); }}
                style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${G}66`, objectFit: "cover", margin: "4px auto", display: "block", boxShadow: `0 0 12px ${G}44` }} />
              <div style={{ fontSize: 9, fontWeight: 800, color: "#e8e8e8", letterSpacing: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.you ? "YOU" : u.n}</div>
              <div style={{ fontSize: 10, fontWeight: 900, color: G, textShadow: `0 0 8px ${G}66` }}>{u.c}</div>
              <div style={{ fontSize: 7.5, color: "#666", letterSpacing: 1 }}>{u.s}d STREAK</div>
            </div>
          ))}
        </div>
      )}

      {rest.map((u, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "7px 8px",
          background: u.you ? `linear-gradient(90deg, ${G}22, transparent)` : "rgba(0,0,0,0.3)",
          border: `1px solid ${u.you ? G + "66" : "#222"}`, borderLeft: `3px solid ${u.you ? G : "#333"}`,
          marginBottom: 4, borderRadius: 2,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#555", width: 18, textAlign: "center" }}>{i + 4}</div>
          <img src={u.img} onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackAvatar(u.n); }} style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${G}44`, objectFit: "cover" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", letterSpacing: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.you ? "YOU" : u.n}</div>
            <div style={{ fontSize: 8, color: "#666", letterSpacing: 1 }}>{u.s} DAY STREAK</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: G, textShadow: `0 0 8px ${G}66` }}>{u.c}</div>
        </div>
      ))}
    </div>
  );
}
