import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { cardStyle, titleStyle } from "@/tabs/styles";
import { FocusMusicPanel } from "@/components/FocusMusicPanel";

export type FocusTier = { id: "f49" | "f120" | "f229"; label: string; sub: string; minutes: number; reward: number };

export const FOCUS_TIERS: FocusTier[] = [
  { id: "f49", label: "49 MIN", sub: "IGNITION", minutes: 49, reward: 15 },
  { id: "f120", label: "2 HOURS", sub: "DEEP DIVE", minutes: 120, reward: 25 },
  { id: "f229", label: "3H 49M", sub: "MONK MODE", minutes: 229, reward: 40 },
];

const APP_GROUPS: { group: string; icon: string; apps: string[] }[] = [
  { group: "SOCIAL MEDIA", icon: "📱", apps: ["Instagram", "Snapchat", "X / Twitter", "Facebook", "Reddit"] },
  { group: "GAMES", icon: "🎮", apps: ["BGMI / PUBG", "Free Fire", "Clash of Clans", "Candy Crush"] },
  { group: "MESSAGING", icon: "💬", apps: ["WhatsApp", "Telegram", "Discord"] },
  { group: "VIDEO STREAMING", icon: "📺", apps: ["YouTube", "Netflix", "Prime Video", "Hotstar"] },
];

import gamma40 from "@/assets/audio/gamma40.mp3.asset.json";
import alpha8d from "@/assets/audio/alpha8d.mp3.asset.json";
import solfeggio528 from "@/assets/audio/solfeggio528.mp3.asset.json";
import zen432 from "@/assets/audio/zen432.mp3.asset.json";
import focusMatrix from "@/assets/audio/focusmatrix.mp3.asset.json";
import battleWave from "@/assets/audio/battlewave.mp3.asset.json";
import eagleMentor from "@/assets/eagle-mentor.jpg.asset.json";

const MENTOR_LINES = [
  "THE EAGLE NEVER BLINKS. NEITHER DO YOU.",
  "ONE SCREEN. ONE MISSION. NO ESCAPE.",
  "PREDATORS FOCUS. PREY SCROLLS.",
  "ALTITUDE IS EARNED IN SILENCE.",
  "YOUR ATTENTION IS THE ONLY CURRENCY.",
  "STAY. THE SUMMIT IS CLOSER THAN COMFORT.",
];


const TRACKS = [
  { id: 1, name: "40Hz GAMMA + BROWN NOISE", tag: "10:00 · PURE BINAURAL", src: gamma40.url },
  { id: 2, name: "BINAURAL ALPHA WAVES 8D", tag: "09:50 · ALPHA FLOW", src: alpha8d.url },
  { id: 3, name: "528Hz HEALING + NATURE", tag: "07:16 · SOLFEGGIO", src: solfeggio528.url },
  { id: 4, name: "432Hz ZEN STRESS RELIEF", tag: "08:27 · DEEP CALM", src: zen432.url },
  { id: 5, name: "FOCUS MATRIX DEEP HOUSE", tag: "05:32 · STUDY DRIVE", src: focusMatrix.url },
  { id: 6, name: "BATTLE WAVE", tag: "01:52 · WAR MODE", src: battleWave.url },
];


const LS_KEY = "dwt_focus_session";

type Phase = "idle" | "setup" | "active" | "done";
type LockMode = "strict" | "flex";

const two = (n: number) => String(n).padStart(2, "0");
const fmt = (s: number) => `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;

export function DeepFocus({ G, G2, onComplete }: {
  G: string; G2: string;
  onComplete: (tier: FocusTier, lockMode: LockMode, apps: string[]) => Promise<number | null>;
}) {
  const CARD = cardStyle(G);
  const [phase, setPhase] = useState<Phase>("idle");
  const [tier, setTier] = useState<FocusTier | null>(null);
  const [lockMode, setLockMode] = useState<LockMode>("strict");
  const [blocked, setBlocked] = useState<string[]>(APP_GROUPS.flatMap(g => g.apps));
  const [custom, setCustom] = useState("");
  const [customApps, setCustomApps] = useState<string[]>([]);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState<{ awarded: number; coins: number | null; minutes: number } | null>(null);
  const [penalty, setPenalty] = useState(0);
  const [showAudio, setShowAudio] = useState(true);
  const [showMusic, setShowMusic] = useState(false);
  const [trackIdx, setTrackIdx] = useState(0);
  const [loop, setLoop] = useState(true);
  const [vol, setVol] = useState(0.7);
  const [missing, setMissing] = useState<Record<number, boolean>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const finishing = useRef(false);

  // restore an in-flight session after reload
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      const t = FOCUS_TIERS.find(x => x.id === s.tierId);
      if (!t || !s.endsAt || s.endsAt <= Date.now()) { localStorage.removeItem(LS_KEY); return; }
      setTier(t); setLockMode(s.lockMode || "strict"); setBlocked(s.blocked || []);
      setEndsAt(s.endsAt); setPhase("active");
    } catch { /* ignore */ }
  }, []);

  const finish = useCallback(async (t: FocusTier) => {
    if (finishing.current) return;
    finishing.current = true;
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    audioRef.current?.pause();
    const coins = await onComplete(t, lockMode, blocked);
    setResult({ awarded: t.reward, coins, minutes: t.minutes });
    setPhase("done");
    finishing.current = false;
  }, [onComplete, lockMode, blocked]);

  useEffect(() => {
    if (phase !== "active" || !endsAt || !tier) return;
    const id = setInterval(() => {
      const s = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) { clearInterval(id); void finish(tier); }
    }, 250);
    return () => clearInterval(id);
  }, [phase, endsAt, tier, finish]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = vol; }, [vol, trackIdx]);

  const toggleApp = (a: string) =>
    setBlocked(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);

  const confirmLock = () => {
    if (!tier) return;
    const end = Date.now() + tier.minutes * 60_000;
    setEndsAt(end); setLeft(tier.minutes * 60); setPhase("active"); setPenalty(0);
    try { localStorage.setItem(LS_KEY, JSON.stringify({ tierId: tier.id, endsAt: end, lockMode, blocked })); } catch { /* ignore */ }
  };

  const abandon = () => {
    if (lockMode === "strict") return;
    setPenalty(p => p + 5);
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    audioRef.current?.pause();
    setPhase("idle"); setEndsAt(null); setTier(null);
  };

  const allApps = [...APP_GROUPS.flatMap(g => g.apps), ...customApps];

  /* ---------------- IDLE: tier picker ---------------- */
  if (phase === "idle") {
    return (
      <div style={{ ...CARD, padding: 12, marginBottom: 8 }}>
        <div style={{ ...titleStyle, marginBottom: 6 }}>
          <span style={{ color: G }}>▸</span> DEEP <span style={{ color: G }}>FOCUS SYSTEM</span>
          <button onClick={() => setShowMusic(true)} aria-label="Open focus music" style={{
            marginLeft: "auto", display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 8, cursor: "pointer",
            background: "transparent", border: `1px solid ${G}44`, color: G, padding: 0,
          }}>
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>
        {showMusic && <FocusMusicPanel onClose={() => setShowMusic(false)} />}
        <div style={{ fontSize: 8.5, color: "#888", letterSpacing: 1.2, lineHeight: 1.5, marginBottom: 10 }}>
          LOCK YOUR APPS. STACK UNLIMITED SESSIONS. CLIMB THE LEADERBOARD.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 6 }}>
          {FOCUS_TIERS.map(t => (
            <button key={t.id} onClick={() => { setTier(t); setPhase("setup"); }} style={{
              padding: "10px 6px", cursor: "pointer", textAlign: "center", borderRadius: 2,
              background: `linear-gradient(160deg, ${G}18, transparent)`,
              border: `1px solid ${G}33`, borderTop: `2px solid ${G}`, color: "#e8e8e8", fontFamily: "monospace",
            }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: G, textShadow: `0 0 12px ${G}88`, lineHeight: 1 }}>
                {t.minutes >= 60 ? Math.floor(t.minutes / 60) : t.minutes}
                <span style={{ fontSize: 8, color: "#777", marginLeft: 2 }}>{t.minutes >= 60 ? "H" : "M"}</span>
              </div>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, marginTop: 4 }}>{t.label}</div>
              <div style={{ fontSize: 7.5, color: "#777", letterSpacing: 1.2, marginTop: 2 }}>{t.sub}</div>
              <div style={{ fontSize: 10, fontWeight: 900, color: G, marginTop: 5 }}>+{t.reward}</div>
              <div style={{ fontSize: 7, color: "#666", letterSpacing: 1 }}>COINS · PTS</div>
            </button>
          ))}
        </div>
        {penalty > 0 && <div style={{ fontSize: 8.5, color: "#ff5566", letterSpacing: 1.5, marginTop: 6 }}>◉ LAST SESSION ABANDONED · -{penalty} PTS</div>}
      </div>

    );
  }

  /* ---------------- SETUP: app locking modal ---------------- */
  if (phase === "setup" && tier) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(3,3,10,0.9)", backdropFilter: "blur(8px)", overflowY: "auto", padding: "calc(16px + env(safe-area-inset-top,0px)) 16px calc(16px + env(safe-area-inset-bottom,0px))" }}>
        <div style={{ maxWidth: 400, margin: "0 auto", background: "rgba(10,10,25,0.95)", border: `1px solid ${G}`, boxShadow: `0 0 40px ${G}55`, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 3, color: "#fff" }}>LOCK SETUP</div>
            <button onClick={() => { setPhase("idle"); setTier(null); }} style={{ background: "none", border: "none", color: "#666", fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ fontSize: 10, color: G, letterSpacing: 2, marginBottom: 14 }}>{tier.label} · +{tier.reward} COINS · +{tier.reward} LEADERBOARD PTS</div>

          {/* mode */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {([
              { id: "strict" as LockMode, t: "PERMANENT STRICT", d: "No exit. Zero mercy." },
              { id: "flex" as LockMode, t: "FLEXIBLE FOCUS", d: "Emergency exit · -5 pts" },
            ]).map(m => (
              <button key={m.id} onClick={() => setLockMode(m.id)} style={{
                padding: "10px 8px", cursor: "pointer", textAlign: "left", fontFamily: "monospace",
                background: lockMode === m.id ? `linear-gradient(135deg, ${G}22, transparent)` : "rgba(0,0,0,0.4)",
                border: `1px solid ${lockMode === m.id ? G : "#282838"}`,
                boxShadow: lockMode === m.id ? `0 0 14px ${G}44` : "none", color: "#e8e8e8",
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: lockMode === m.id ? G : "#aaa" }}>{m.t}</div>
                <div style={{ fontSize: 8, color: "#666", marginTop: 4, letterSpacing: 1 }}>{m.d}</div>
              </button>
            ))}
          </div>

          {/* app checklist */}
          <div style={{ fontSize: 9, color: "#888", letterSpacing: 2, marginBottom: 8 }}>SELECT APPS TO BLOCK · {blocked.length} LOCKED</div>
          {APP_GROUPS.map(g => (
            <div key={g.group} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: G, letterSpacing: 2, marginBottom: 5 }}>{g.icon} {g.group}</div>
              {g.apps.map(a => {
                const on = blocked.includes(a);
                return (
                  <div key={a} onClick={() => toggleApp(a)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 4, cursor: "pointer",
                    background: on ? `linear-gradient(90deg, ${G}12, transparent)` : "rgba(0,0,0,0.3)",
                    border: `1px solid ${on ? G + "44" : "#222"}`, borderLeft: `3px solid ${on ? G : "#333"}`,
                  }}>
                    <div style={{ flex: 1, fontSize: 11, letterSpacing: 1, color: on ? "#e8e8e8" : "#777" }}>{a}</div>
                    <div style={{
                      width: 34, height: 18, borderRadius: 10, background: on ? G : "#1c1c28",
                      border: `1px solid ${on ? G : "#333"}`, position: "relative", transition: "all .2s",
                      boxShadow: on ? `0 0 10px ${G}88` : "none",
                    }}>
                      <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 12, height: 12, borderRadius: "50%", background: on ? "#03030a" : "#555", transition: "all .2s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* custom apps */}
          <div style={{ fontSize: 9, color: G, letterSpacing: 2, marginBottom: 5 }}>➕ CUSTOM APPS</div>
          {customApps.map(a => {
            const on = blocked.includes(a);
            return (
              <div key={a} onClick={() => toggleApp(a)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 4, cursor: "pointer",
                background: on ? `linear-gradient(90deg, ${G}12, transparent)` : "rgba(0,0,0,0.3)",
                border: `1px solid ${on ? G + "44" : "#222"}`, borderLeft: `3px solid ${on ? G : "#333"}`,
              }}>
                <div style={{ flex: 1, fontSize: 11, letterSpacing: 1, color: on ? "#e8e8e8" : "#777" }}>{a}</div>
                <div style={{ fontSize: 9, color: on ? G : "#555", letterSpacing: 1 }}>{on ? "LOCKED" : "OPEN"}</div>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="App name…" style={{
              flex: 1, background: "rgba(0,0,0,0.5)", border: `1px solid ${G}33`, color: "#e8e8e8",
              padding: "8px 10px", fontSize: 11, fontFamily: "monospace", letterSpacing: 1, outline: "none",
            }} />
            <button onClick={() => {
              const v = custom.trim();
              if (!v || allApps.includes(v)) return;
              setCustomApps(p => [...p, v]); setBlocked(p => [...p, v]); setCustom("");
            }} style={{ background: `${G}22`, border: `1px solid ${G}`, color: G, padding: "0 14px", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>ADD</button>
          </div>

          <button onClick={confirmLock} style={{
            width: "100%", padding: "13px", cursor: "pointer", fontFamily: "monospace",
            background: `linear-gradient(90deg, ${G}, ${G2})`, border: "none", color: "#03030a",
            fontSize: 12, fontWeight: 900, letterSpacing: 3, boxShadow: `0 0 24px ${G}88`,
          }}>🔒 CONFIRM &amp; LOCK SESSION</button>
        </div>
      </div>
    );
  }

  /* ---------------- ACTIVE: immersive session ---------------- */
  if (phase === "active" && tier) {
    const total = tier.minutes * 60;
    const pct = total ? (total - left) / total : 0;
    const R = 74, C = 2 * Math.PI * R;
    const track = TRACKS[trackIdx]!;
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "radial-gradient(circle at 50% 35%, #0a0a1e 0%, #03030a 70%)", overflowY: "auto", padding: "calc(24px + env(safe-area-inset-top,0px)) 16px calc(24px + env(safe-area-inset-bottom,0px))", fontFamily: "monospace" }}>
        <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: G, animation: "pulse 2s infinite" }}>
            ◉ {lockMode === "strict" ? "STRICT APP LOCK ENFORCED" : "FLEXIBLE FOCUS ACTIVE"}
          </div>
          <div style={{ fontSize: 9, color: "#666", letterSpacing: 2, marginTop: 6 }}>{blocked.length} APPS BLOCKED · {tier.sub}</div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", margin: "14px 0" }}>
            <div style={{ position: "relative", width: 180, height: 180 }}>
              <svg width="180" height="180" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="90" cy="90" r={R} fill="none" stroke="#15152a" strokeWidth="8" />
                <circle cx="90" cy="90" r={R} fill="none" stroke={G} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ filter: `drop-shadow(0 0 10px ${G})`, transition: "stroke-dashoffset .3s linear" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", textShadow: `0 0 18px ${G}`, letterSpacing: 2 }}>{fmt(left)}</div>
                <div style={{ fontSize: 9, color: "#777", letterSpacing: 3, marginTop: 6 }}>{Math.round(pct * 100)}% COMPLETE</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 132, height: 186, borderRadius: 14, overflow: "hidden",
                border: "1px solid rgba(212,175,55,0.55)",
                boxShadow: `0 0 26px rgba(212,175,55,0.25), 0 0 40px ${G}33, inset 0 0 40px rgba(0,0,0,0.8)`,
                background: "#000", position: "relative",
              }}>
                <img src={eagleMentor.url} alt="Eagle mentor watching your focus session" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.15) saturate(1.05) brightness(1.02)" }} />
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 38%, transparent 30%, rgba(0,0,0,0.78) 100%)" }} />
                <div style={{ position: "absolute", left: 0, right: 0, height: 40, background: `linear-gradient(180deg, transparent, ${G}22, transparent)`, animation: "scan-sweep 3.6s linear infinite" }} />
                <div style={{ position: "absolute", bottom: 6, left: 0, right: 0, textAlign: "center", fontSize: 7.5, letterSpacing: 2, color: "#d4af37", textShadow: "0 0 10px rgba(212,175,55,0.8)" }}>MENTOR MODE</div>
              </div>
              <div style={{ fontSize: 8, letterSpacing: 2.5, color: G, textShadow: `0 0 8px ${G}` }}>◉ EYES ON YOU</div>
              <div style={{ fontSize: 7.5, color: "#8a8a8a", letterSpacing: 1.2, maxWidth: 134, textAlign: "center", lineHeight: 1.5 }}>
                {MENTOR_LINES[Math.floor(left / 15) % MENTOR_LINES.length]}
              </div>
            </div>

          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <div style={{ border: `1px solid ${G}33`, padding: "10px", background: `linear-gradient(135deg, ${G}12, transparent)` }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: G }}>+{tier.reward}</div>
              <div style={{ fontSize: 8, color: "#777", letterSpacing: 2 }}>COINS PENDING</div>
            </div>
            <div style={{ border: `1px solid ${G}33`, padding: "10px", background: `linear-gradient(135deg, ${G}12, transparent)` }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: G }}>+{tier.reward}</div>
              <div style={{ fontSize: 8, color: "#777", letterSpacing: 2 }}>LEADERBOARD PTS</div>
            </div>
          </div>

          {/* audio hub */}
          <div style={{ border: `1px solid ${G}33`, background: "rgba(10,10,25,0.7)", textAlign: "left" }}>
            <button onClick={() => setShowAudio(s => !s)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "none", border: "none", color: "#e8e8e8", cursor: "pointer", fontFamily: "monospace" }}>
              <span style={{ fontSize: 10, letterSpacing: 3 }}>🎧 FREQUENCY HUB</span>
              <span style={{ fontSize: 10, color: G }}>{showAudio ? "▾" : "▸"}</span>
            </button>
            {showAudio && (
              <div style={{ padding: "0 12px 12px", maxHeight: 190, overflowY: "auto" }}>
                {TRACKS.map((t, i) => (
                  <div key={t.id} onClick={() => setTrackIdx(i)} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", marginBottom: 4, cursor: "pointer",
                    background: i === trackIdx ? `linear-gradient(90deg, ${G}18, transparent)` : "rgba(0,0,0,0.3)",
                    border: `1px solid ${i === trackIdx ? G + "55" : "#222"}`, borderLeft: `3px solid ${i === trackIdx ? G : "#333"}`,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, letterSpacing: 1.5, color: i === trackIdx ? "#fff" : "#999" }}>{t.name}</div>
                      <div style={{ fontSize: 8, color: missing[t.id] ? "#ff5566" : "#666", letterSpacing: 1, marginTop: 2 }}>
                        {missing[t.id] ? "TRACK UNAVAILABLE" : t.tag}
                      </div>

                    </div>
                    {i === trackIdx && <span style={{ fontSize: 10, color: G }}>◉</span>}
                  </div>
                ))}
                <audio
                  ref={audioRef}
                  key={track.src}
                  src={track.src}
                  controls
                  loop={loop}
                  autoPlay
                  onError={() => setMissing(m => ({ ...m, [track.id]: true }))}
                  onCanPlay={() => setMissing(m => ({ ...m, [track.id]: false }))}
                  style={{ width: "100%", marginTop: 6, filter: "invert(1) hue-rotate(180deg)", opacity: 0.85 }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <button onClick={() => setLoop(l => !l)} style={{
                    background: loop ? `${G}22` : "rgba(0,0,0,0.4)", border: `1px solid ${loop ? G : "#333"}`,
                    color: loop ? G : "#777", fontSize: 9, letterSpacing: 2, padding: "6px 10px", cursor: "pointer", fontFamily: "monospace",
                  }}>🔁 LOOP {loop ? "ON" : "OFF"}</button>
                  <span style={{ fontSize: 9, color: "#777", letterSpacing: 1 }}>VOL</span>
                  <input type="range" min={0} max={1} step={0.01} value={vol} onChange={e => setVol(Number(e.target.value))} style={{ flex: 1, accentColor: G }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            {lockMode === "strict" ? (
              <div style={{ fontSize: 9, color: "#666", letterSpacing: 2, lineHeight: 1.7 }}>
                🔒 STRICT LOCK — NO EXIT UNTIL 00:00:00.<br />DISCIPLINE IS DOING IT WHEN YOU DON'T FEEL LIKE IT.
              </div>
            ) : (
              <button onClick={abandon} style={{
                background: "rgba(255,60,90,0.08)", border: "1px solid #ff556644", color: "#ff5566",
                fontSize: 9, letterSpacing: 2, padding: "10px 16px", cursor: "pointer", fontFamily: "monospace",
              }}>⚠ EMERGENCY OVERRIDE · -5 PTS</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- DONE: summary ---------------- */
  if (phase === "done" && result) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(3,3,10,0.92)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "monospace", overflowY: "auto", overflowX: "clip" }}>
        {Array.from({ length: 24 }, (_, i) => (
          <div key={i} style={{
            position: "absolute", top: 0, left: `${(i * 41) % 100}%`, width: 4, height: 12,
            background: i % 3 === 0 ? "#fff" : i % 3 === 1 ? G : G2, boxShadow: `0 0 8px ${G}`,
            animation: `confetti-fall ${2.2 + ((i * 17) % 18) / 10}s linear ${(i % 10) * 0.2}s infinite`,
          }} />
        ))}
        <div style={{ position: "relative", maxWidth: 340, width: "100%", textAlign: "center", padding: "28px 20px", background: "rgba(10,10,25,0.95)", border: `1px solid ${G}`, boxShadow: `0 0 46px ${G}77`, animation: "celebrate-pop .5s ease-out" }}>
          <div style={{ fontSize: 46, filter: `drop-shadow(0 0 16px ${G})` }}>🧠</div>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 3, color: "#fff", marginTop: 8, textShadow: `0 0 14px ${G}` }}>FOCUS COMPLETE</div>
          <div style={{ width: 90, height: 2, background: `linear-gradient(90deg,transparent,${G},transparent)`, margin: "12px auto" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "14px 0" }}>
            <div style={{ border: `1px solid ${G}33`, padding: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: G }}>+{result.awarded}</div>
              <div style={{ fontSize: 8, color: "#777", letterSpacing: 2 }}>COINS EARNED</div>
            </div>
            <div style={{ border: `1px solid ${G}33`, padding: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: G }}>{result.minutes}m</div>
              <div style={{ fontSize: 8, color: "#777", letterSpacing: 2 }}>DEEP WORK</div>
            </div>
          </div>
          {result.coins !== null && (
            <div style={{ fontSize: 10, color: G, letterSpacing: 2 }}>◉ WALLET BALANCE: {result.coins} COINS</div>
          )}
          <div style={{ fontSize: 9, color: "#777", letterSpacing: 2, marginTop: 6 }}>LEADERBOARD SCORE UPDATED (+{result.awarded} PTS)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18 }}>
            <button onClick={() => { setPhase("idle"); setTier(null); setResult(null); }} style={{
              padding: "11px", background: "rgba(0,0,0,0.5)", border: `1px solid ${G}55`, color: "#ccc",
              fontSize: 10, letterSpacing: 2, cursor: "pointer", fontFamily: "monospace",
            }}>← BACK HOME</button>
            <button onClick={() => { setResult(null); setPhase("setup"); }} style={{
              padding: "11px", background: `linear-gradient(90deg, ${G}, ${G2})`, border: "none", color: "#03030a",
              fontSize: 10, fontWeight: 900, letterSpacing: 2, cursor: "pointer", fontFamily: "monospace", boxShadow: `0 0 18px ${G}88`,
            }}>STACK ANOTHER →</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
