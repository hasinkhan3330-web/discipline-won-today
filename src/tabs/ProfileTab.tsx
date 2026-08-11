import { useState } from "react";
import { cardStyle, titleStyle } from "./styles";
import { THEMES, type ThemeKey } from "@/constants/themes";
import { ManageSubscriptionCard } from "@/components/ManageSubscriptionCard";
import { SubscriptionTimeline } from "@/components/SubscriptionTimeline";
import { SubTabs, Accordion, Rail } from "@/components/Collapse";

type BoardEntry = { n: string; c: number; s: number; img: string; you?: boolean };

const TIERS = [
  { min: 0,     name: "INITIATE",           icon: "◌", tag: "The path begins" },
  { min: 500,   name: "SEED",               icon: "🌱", tag: "Roots taking hold" },
  { min: 1000,  name: "WARRIOR",            icon: "⚔️", tag: "Forged in fire" },
  { min: 2000,  name: "MONK",               icon: "☯",  tag: "Mind over noise" },
  { min: 21000, name: "DISCIPLINE MASTER",  icon: "👑", tag: "Legend unlocked" },
];

const VICTORIES = [
  { d: 1,   label: "DAY 1 · THE FIRST STEP",     line: "The first step is the heaviest. Most surrender here — but you did not.", img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=90" },
  { d: 7,   label: "DAY 7 · IRON WEEK",           line: "One full week. 95% quit before this line. You crossed it in silence.", img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&q=90" },
  { d: 21,  label: "DAY 21 · NEURAL FORGE",       line: "Twenty-one days. Your brain has begun rewiring. The old you is dying.", img: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=1200&q=90" },
  { d: 60,  label: "DAY 60 · STEEL SPINE",        line: "Sixty days of war with yourself — and you kept winning every single dawn.", img: "https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=1200&q=90" },
  { d: 90,  label: "DAY 90 · IDENTITY SHIFT",     line: "Ninety days. You are no longer trying to change — you have already changed.", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=90" },
  { d: 120, label: "DAY 120 · FORGED IN FIRE",    line: "Four months of fire. What was once impossible is now your ordinary day.", img: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=1200&q=90" },
  { d: 170, label: "DAY 170 · UNBREAKABLE",       line: "One hundred seventy sunrises. You cannot be stopped by weakness anymore.", img: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=1200&q=90" },
  { d: 290, label: "DAY 290 · MASTER OF SELF",    line: "Two hundred ninety days. You command yourself where others still beg themselves.", img: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=1200&q=90" },
  { d: 360, label: "DAY 360 · LEGEND STATUS",     line: "One year. You did not build a habit — you became a different human being.", img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=1200&q=90" },
];

export function ProfileTab({
  G, G2, coins, streak,
  myName, myAvatar, uploading,
  themeKey, setThemeKey,
  board, openCropper,
  fallbackAvatar,
  todayDone = 0, todayTotal = 0,
}: {
  G: string; G2: string;
  coins: number; streak: number;
  myName: string; myAvatar: string; uploading: boolean;
  themeKey: ThemeKey; setThemeKey: (k: ThemeKey) => void;
  board: BoardEntry[];
  openCropper: (f: File) => void;
  fallbackAvatar: (n: string) => string;
  todayDone?: number; todayTotal?: number;
}) {
  const CARD = cardStyle(G);
  const TITLE = titleStyle;
  const [tab, setTab] = useState("rank");


  const dayPct = todayTotal ? Math.round((todayDone / todayTotal) * 100) : 0;
  const zone = dayPct >= 100 ? "#00ff88" : dayPct >= 50 ? "#ffcc33" : "#ff3b5c";
  const zoneLabel = dayPct >= 100 ? "PERFECT DAY · 100%" : dayPct >= 50 ? "ALMOST THERE" : "DANGER ZONE";

  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (coins >= TIERS[i].min) idx = i;
  const cur = TIERS[idx];
  const next = TIERS[idx + 1];
  const tierPct = next ? Math.min(100, Math.round(((coins - cur.min) / (next.min - cur.min)) * 100)) : 100;

  const roster = board.length ? board : [{ n: myName.toUpperCase(), c: coins, s: streak, img: fallbackAvatar(myName), you: true }];
  const [top, second, third] = roster;


  return (
    <>
      <div style={{ ...CARD, padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
          <img
            src={myAvatar || fallbackAvatar(myName)}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackAvatar(myName); }}
            alt="me"
            style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: `2px solid ${G}`, boxShadow: `0 0 18px ${G}88` }}
          />
          <div style={{ position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: "50%", background: G, color: "#000", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 10px ${G}` }}>◉</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: G, letterSpacing: 3, marginBottom: 4 }}>◈ YOUR IDENTITY</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: 2, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{myName.toUpperCase()}</div>
          <label style={{
            display: "inline-block", cursor: uploading ? "wait" : "pointer",
            padding: "8px 12px", background: `linear-gradient(135deg, ${G}33, transparent)`,
            border: `1px solid ${G}`, borderLeft: `3px solid ${G}`,
            fontSize: 10, letterSpacing: 2, fontWeight: 800, color: G,
            fontFamily: "monospace", boxShadow: `0 0 12px ${G}44`,
            opacity: uploading ? 0.6 : 1,
          }}>
            {uploading ? "◌ UPLOADING…" : "📷 UPLOAD FROM GALLERY"}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) openCropper(f); e.currentTarget.value = ""; }}
              style={{ display: "none" }}
            />
          </label>
          <div style={{ fontSize: 9, color: "#666", marginTop: 6, letterSpacing: 1 }}>CROP · FIT · SYNCS TO RANK</div>
        </div>
      </div>

      {/* DAILY POWER COLUMN */}
      <div style={{ ...CARD, padding: 12, marginBottom: 8, borderLeft: `2px solid ${zone}`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 90% 0%, ${zone}22, transparent 60%)`, pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ ...TITLE, marginBottom: 10 }}>
            <span style={{ color: zone }}>▸</span> TODAY'S <span style={{ color: zone }}>POWER COLUMN</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* vertical glow column */}
            <div style={{
              width: 28, height: 104, borderRadius: 4, background: "#07070f",
              border: `1px solid ${zone}55`, position: "relative", overflow: "hidden",
              boxShadow: `0 0 16px ${zone}44 inset`,
            }}>
              <div style={{
                position: "absolute", left: 0, right: 0, bottom: 0, height: `${dayPct}%`,
                background: `linear-gradient(180deg, ${zone}, ${zone}66)`,
                boxShadow: `0 0 22px ${zone}, 0 0 44px ${zone}88`,
                animation: "cell-glow 2.2s ease-in-out infinite",
                transition: "height 0.6s ease",
              }} />
              {[25, 50, 75].map(p => (
                <div key={p} style={{ position: "absolute", left: 0, right: 0, bottom: `${p}%`, height: 1, background: "rgba(255,255,255,0.12)" }} />
              ))}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: zone, textShadow: `0 0 18px ${zone}` }}>{dayPct}%</div>
                {/* shiny tick */}
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 17, fontWeight: 900, color: "#04040a",
                  background: dayPct >= 100 ? `linear-gradient(135deg, #b6ffdd, #00ff88)` : "rgba(0,0,0,0.4)",
                  border: `1.5px solid ${dayPct >= 100 ? "#00ff88" : "#2a2a3a"}`,
                  boxShadow: dayPct >= 100 ? "0 0 18px #00ff88, 0 0 38px #00ff8877" : "none",
                  animation: dayPct >= 100 ? "tick-shine 1.6s ease-in-out infinite" : "none",
                }}>{dayPct >= 100 ? "✓" : ""}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2.5, color: zone, marginTop: 4 }}>{zoneLabel}</div>
              <div style={{ fontSize: 10, color: "#888", letterSpacing: 1.5, marginTop: 4 }}>
                {todayDone}/{todayTotal} TASKS DONE TODAY
              </div>
              <div style={{ fontSize: 9, color: "#666", letterSpacing: 1.2, marginTop: 6, lineHeight: 1.5 }}>
                {dayPct >= 100
                  ? "No excuses left. The column is full — habit locked."
                  : dayPct >= 50
                    ? "Yellow means unfinished. Finish it before midnight."
                    : "Red column. Every missed day costs you 3 coins."}
              </div>
            </div>
          </div>
        </div>
      </div>



      <SubTabs G={G} active={tab} onChange={setTab} tabs={[
        { id: "rank", label: "RANK" },
        { id: "themes", label: "THEMES" },
        { id: "plan", label: "PLAN" },
      ]} />

      {tab === "rank" && (
      <div style={{ ...CARD, position: "relative", overflow: "hidden", padding: 14 }}>

        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 15% 10%, ${G}22, transparent 60%)`, pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: G, letterSpacing: 3 }}>◈ RANK TIER</div>
            <div style={{ fontSize: 10, color: "#888", letterSpacing: 2 }}>{coins} COINS</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12,
              background: `linear-gradient(135deg, ${G}44, ${G2}22)`,
              border: `1px solid ${G}`, boxShadow: `0 0 16px ${G}66, inset 0 0 12px ${G}33`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
            }}>{cur.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: 3, textShadow: `0 0 10px ${G}` }}>{cur.name}</div>
              <div style={{ fontSize: 10, color: G, letterSpacing: 2 }}>{cur.tag}</div>
            </div>
          </div>
          <div style={{ height: 8, background: "#0a0a15", border: `1px solid ${G}33`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${tierPct}%`, background: `linear-gradient(90deg, ${G}, ${G2})`, boxShadow: `0 0 10px ${G}` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9, color: "#888", letterSpacing: 1 }}>
            <span>{cur.min}</span>
            <span style={{ color: G }}>{next ? `NEXT: ${next.name} · ${next.min - coins} TO GO` : "◉ MAXIMUM RANK ACHIEVED"}</span>
            <span>{next ? next.min : "∞"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4, marginTop: 12 }}>
            {TIERS.map((t, i) => (
              <div key={t.name} style={{
                textAlign: "center", padding: "6px 2px",
                background: i <= idx ? `linear-gradient(135deg, ${G}22, transparent)` : "rgba(0,0,0,0.3)",
                border: `1px solid ${i <= idx ? G : "#222"}`,
                borderLeft: `2px solid ${i <= idx ? G : "#333"}`,
                opacity: i <= idx ? 1 : 0.45,
              }}>
                <div style={{ fontSize: 14 }}>{t.icon}</div>
                <div style={{ fontSize: 7, color: i <= idx ? G : "#666", letterSpacing: 1, marginTop: 2, fontWeight: 800 }}>{t.name.split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}


      {tab === "plan" && (
        <>
          <ManageSubscriptionCard />
          <SubscriptionTimeline />
        </>
      )}

      {tab === "rank" && top && (

        <div style={{ ...CARD, textAlign: "center", padding: 22, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle, ${G}44, transparent 70%)` }} />
          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ fontSize: 10, color: G, letterSpacing: 4, marginBottom: 10 }}>◈ #1 ON THE GRID ◈</div>
            <div style={{ position: "relative", width: 110, height: 110, margin: "0 auto 10px" }}>
              <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: `2px solid ${G}`, boxShadow: `0 0 24px ${G}, inset 0 0 16px ${G}66`, animation: "orbit 10s linear infinite" }}>
                <div style={{ position: "absolute", top: -4, left: "50%", width: 8, height: 8, borderRadius: "50%", background: G2, boxShadow: `0 0 12px ${G2}` }} />
              </div>
              <img src={top.img} alt={top.n} style={{ width: 110, height: 110, borderRadius: "50%", objectFit: "cover", border: `3px solid ${G}`, boxShadow: `0 0 30px ${G}` }} />
              <div style={{ position: "absolute", bottom: -4, right: -4, fontSize: 26, filter: `drop-shadow(0 0 8px ${G})` }}>🥇</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 3, textShadow: `0 0 12px ${G}` }}>{top.n}</div>
            <div style={{ fontSize: 11, color: G, letterSpacing: 2, marginBottom: 14 }}>{top.c} COINS · {top.s}d STREAK</div>

            <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 6 }}>
              {[{ u: second, medal: "🥈", rank: "#2" }, { u: third, medal: "🥉", rank: "#3" }].filter(x => x.u).map(({ u, medal, rank }) => (
                <div key={u!.n} style={{ textAlign: "center" }}>
                  <div style={{ position: "relative", width: 62, height: 62, margin: "0 auto 6px" }}>
                    <img src={u!.img} alt={u!.n} style={{ width: 62, height: 62, borderRadius: "50%", objectFit: "cover", border: `2px solid ${G}88`, boxShadow: `0 0 12px ${G}55` }} />
                    <div style={{ position: "absolute", bottom: -3, right: -3, fontSize: 16 }}>{medal}</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#e8e8e8", letterSpacing: 1 }}>{u!.n}</div>
                  <div style={{ fontSize: 9, color: G, letterSpacing: 1 }}>{rank} · {u!.c}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "themes" && (
      <Accordion G={G} title={<span>THEME SELECTOR</span>} defaultOpen>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {(Object.keys(THEMES) as ThemeKey[]).map(k => {
            const t = THEMES[k];
            const active = themeKey === k;
            const locked = streak < t.unlock;
            return (
              <button key={k} onClick={() => { if (!locked) setThemeKey(k); }} disabled={locked} style={{
                background: active ? `linear-gradient(135deg, ${t.accent}33, ${t.accent2}22)` : "rgba(0,0,0,0.3)",
                border: `1px solid ${active ? t.accent : "#333"}`,
                borderLeft: `3px solid ${locked ? "#333" : t.accent}`,
                padding: "12px 10px", cursor: locked ? "not-allowed" : "pointer", color: "#e8e8e8",
                fontFamily: "monospace", textAlign: "left",
                opacity: locked ? 0.45 : 1,
                boxShadow: active ? `0 0 15px ${t.accent}55` : "none",
              }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.accent, boxShadow: `0 0 8px ${t.accent}` }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.accent2 }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: active ? t.accent : "#ccc" }}>{t.name}</div>
                <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
                  {locked ? `🔒 ${t.unlock}-DAY STREAK` : active ? "◉ ACTIVE" : "○ SELECT"}
                </div>
              </button>
            );
          })}

        </div>
      </Accordion>
      )}


      {tab === "themes" && (
      <Accordion G={G} title={<span>VICTORIES</span>} defaultOpen>
        <Rail>
          {VICTORIES.map((v, i) => {
            const done = streak >= v.d;
            const progress = Math.min(100, Math.round((streak / v.d) * 100));
            return (
              <div key={i} style={{
                position: "relative", flex: "0 0 190px", scrollSnapAlign: "start",
                overflow: "hidden", borderRadius: 4,
                border: `1px solid ${done ? G + "aa" : "#1a1a2a"}`,
                borderLeft: `3px solid ${done ? G : "#2a2a3a"}`,
                background: "#0a0a15",
                boxShadow: done ? `0 6px 22px ${G}33` : "0 4px 14px rgba(0,0,0,0.5)",
              }}>
                <div style={{ position: "relative", height: 200, overflow: "hidden" }}>
                  <img src={v.img} alt={v.label} loading="lazy" style={{
                    width: "100%", height: "100%", objectFit: "cover", objectPosition: "center",
                    filter: done ? "contrast(1.12) saturate(1.2)" : "grayscale(0.85) brightness(0.45)",
                  }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(5,5,15,0.1) 0%, rgba(5,5,15,0.6) 55%, rgba(5,5,15,0.98) 100%)" }} />
                  <div style={{ position: "absolute", top: 8, left: 8, right: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{
                      fontSize: 7.5, fontWeight: 900, letterSpacing: 1.6, padding: "3px 6px", borderRadius: 2,
                      background: done ? `${G}dd` : "rgba(0,0,0,0.75)", color: done ? "#000" : G,
                      border: `1px solid ${done ? G : G + "44"}`,
                    }}>{done ? "◉ CONQUERED" : "◌ LOCKED"}</div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: done ? G : "#4a4a5a", textShadow: done ? `0 0 14px ${G}` : "none", lineHeight: 1 }}>
                      {v.d}<span style={{ fontSize: 8, marginLeft: 2 }}>D</span>
                    </div>
                  </div>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 10px 12px" }}>
                    <div style={{ fontSize: 7.5, fontWeight: 900, letterSpacing: 2, color: done ? G : "#888", marginBottom: 5 }}>{v.label}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#fff", lineHeight: 1.35, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>"{v.line}"</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${progress}%`, height: "100%", background: done ? G : `linear-gradient(90deg, ${G}66, ${G})`, boxShadow: `0 0 8px ${G}` }} />
                      </div>
                      <div style={{ fontSize: 8, fontWeight: 900, color: done ? G : "#aaa", letterSpacing: 0.5 }}>
                        {done ? "100%" : `${Math.max(0, v.d - streak)}D`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </Rail>
        <div style={{ fontSize: 8, color: "#666", letterSpacing: 1.5, marginTop: 6 }}>← SWIPE TO EXPLORE MILESTONES →</div>
      </Accordion>
      )}
    </>
  );
}

