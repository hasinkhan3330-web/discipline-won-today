import { AX, cardStyle, titleStyle } from "./styles";
import { Coins, Trophy, Flame, Target } from "lucide-react";

export const TIERS = [
  { min: 0,     name: "Initiate",          tag: "The path begins" },
  { min: 500,   name: "Seed",              tag: "Roots taking hold" },
  { min: 1000,  name: "Warrior",           tag: "Forged in fire" },
  { min: 2000,  name: "Monk",              tag: "Mind over noise" },
  { min: 21000, name: "Discipline master", tag: "Legend unlocked" },
];

export function tierFor(coins: number) {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (coins >= TIERS[i].min) idx = i;
  const cur = TIERS[idx];
  const next = TIERS[idx + 1];
  const pct = next ? Math.min(100, Math.round(((coins - cur.min) / (next.min - cur.min)) * 100)) : 100;
  return { idx, cur, next, pct };
}

type BoardEntry = { n: string; c: number; s: number; img: string; you?: boolean };

export function RankTab({ coins, streak, bestStreak = 0, board = [], fallbackAvatar }: {
  coins: number;
  streak: number;
  bestStreak?: number;
  board?: BoardEntry[];
  fallbackAvatar: (n: string) => string;
}) {
  const CARD = cardStyle();
  const { idx, cur, next, pct } = tierFor(coins);

  return (
    <>
      <div style={CARD}>
        <div style={titleStyle}>Your tier</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: "#1D1D28", border: `1px solid ${AX.border}`,
            display: "flex", alignItems: "center", justifyContent: "center", color: AX.accent,
          }}>
            <Trophy size={24} strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: AX.text }}>{cur.name}</div>
            <div style={{ fontSize: 13, color: AX.muted, marginTop: 2 }}>{cur.tag}</div>
          </div>
        </div>

        <div style={{ height: 6, background: "#1D1D28", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: AX.accent, transition: "width .5s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: AX.muted }}>
          <span>{coins} coins</span>
          <span>{next ? `${next.min - coins} to ${next.name}` : "Maximum tier reached"}</span>
        </div>
      </div>

      <div style={{ ...CARD, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { Ico: Coins, v: coins, l: "Coins" },
          { Ico: Flame, v: `${streak}d`, l: "Streak" },
          { Ico: Target, v: `${bestStreak}d`, l: "Best" },
        ].map(s => (
          <div key={s.l} style={{ background: "#181820", border: `1px solid ${AX.border}`, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
            <s.Ico size={18} strokeWidth={1.8} color={AX.accent} />
            <div style={{ fontSize: 18, fontWeight: 600, color: AX.text, marginTop: 6 }}>{s.v}</div>
            <div style={{ fontSize: 12, color: AX.muted, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={CARD}>
        <div style={titleStyle}>All tiers</div>
        {TIERS.map((t, i) => {
          const reached = i <= idx;
          return (
            <div key={t.name} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              background: "#181820", border: `1px solid ${i === idx ? AX.accent : AX.border}`,
              borderRadius: 14, marginBottom: 10,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: 8, flexShrink: 0,
                background: reached ? AX.accent : AX.border,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: reached ? AX.text : AX.muted }}>{t.name}</div>
                <div style={{ fontSize: 12, color: AX.muted, marginTop: 2 }}>{t.tag}</div>
              </div>
              <div style={{ fontSize: 13, color: AX.muted }}>{t.min}</div>
            </div>
          );
        })}
      </div>

      <FriendsPanel myStreak={streak} myCoins={coins} fallbackAvatar={fallbackAvatar} />

      <div style={CARD}>
        <div style={titleStyle}>Global leaderboard</div>
        {board.length === 0 && (
          <EmptyState
            title="Nobody ranked yet"
            line="Complete a habit today and you'll appear on the board within seconds."
          />
        )}
        {board.map((u, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            background: "#181820",
            border: `1px solid ${u.you ? AX.accent : AX.border}`,
            borderRadius: 14, marginBottom: 10,
          }}>
            <div style={{ width: 20, fontSize: 13, color: AX.muted, textAlign: "center" }}>{i + 1}</div>
            <img
              src={u.img}
              alt={u.n}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackAvatar(u.n); }}
              style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: `1px solid ${AX.border}` }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: AX.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.you ? "You" : u.n}</div>
              <div style={{ fontSize: 12, color: AX.muted, marginTop: 2 }}>{u.s} day streak</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: AX.accent }}>{u.c}</div>
          </div>
        ))}
      </div>
    </>
  );
}
