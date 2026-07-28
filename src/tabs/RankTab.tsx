import { cardStyle, titleStyle } from "./styles";

type BoardEntry = { n: string; c: number; s: number; img: string; you?: boolean };

export function RankTab({ G, board, fallbackAvatar }: {
  G: string;
  board: BoardEntry[];
  fallbackAvatar: (n: string) => string;
}) {
  const CARD = cardStyle(G);
  return (
    <div style={CARD}>
      <div style={titleStyle}><span style={{ color: G }}>▸</span> GLOBAL <span style={{ color: G }}>LEADERBOARD</span></div>
      {board.length === 0 && <div style={{ fontSize: 11, color: "#666", textAlign: "center", padding: 20, letterSpacing: 2 }}>LOADING…</div>}
      {board.map((u, i) => {
        const r = i + 1;
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px",
            background: u.you ? `linear-gradient(90deg, ${G}22, transparent)` : "rgba(0,0,0,0.3)",
            border: `1px solid ${u.you ? G + "66" : "#222"}`, borderLeft: `3px solid ${u.you ? G : "#333"}`,
            marginBottom: 6,
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: r <= 3 ? G : "#555", width: 22, textAlign: "center" }}>
              {r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : r}
            </div>
            <img src={u.img} onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackAvatar(u.n); }} style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${G}44`, objectFit: "cover" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e8e8e8", letterSpacing: 1 }}>{u.you ? "YOU" : u.n}</div>
              <div style={{ fontSize: 10, color: "#666", letterSpacing: 1 }}>{u.s} DAY STREAK</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: G, textShadow: `0 0 8px ${G}66` }}>{u.c}</div>
          </div>
        );
      })}
    </div>
  );
}
