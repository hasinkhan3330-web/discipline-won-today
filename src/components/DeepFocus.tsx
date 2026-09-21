import { forwardRef, useState, useEffect, useRef, useCallback, useImperativeHandle } from "react";
import { ChevronRight, Clock3, LockKeyhole, Music2, Plus, Repeat2, Search, Shield, Volume2, X, Zap } from "lucide-react";
import { siFacebook, siInstagram, siX, siYoutube } from "simple-icons/icons";
import { cardStyle } from "@/tabs/styles";
import { FocusMusicPanel } from "@/components/FocusMusicPanel";

export type FocusTier = { id: "f49" | "f120" | "f229"; label: string; sub: string; minutes: number; reward: number };

export const FOCUS_TIERS: FocusTier[] = [
  { id: "f49", label: "49 MIN", sub: "IGNITION", minutes: 49, reward: 5 },
  { id: "f120", label: "2 HOURS", sub: "DEEP DIVE", minutes: 120, reward: 10 },
  { id: "f229", label: "3 HOURS", sub: "MONK MODE", minutes: 180, reward: 15 },
];

const QUICK_BLOCK_APPS = [
  { name: "YouTube", icon: siYoutube },
  { name: "X", icon: siX },
  { name: "Instagram", icon: siInstagram },
  { name: "Facebook", icon: siFacebook },
] as const;

function BrandIcon({ path, title }: { path: string; title: string }) {
  return <svg viewBox="0 0 24 24" role="img" aria-label={title}><path fill="currentColor" d={path} /></svg>;
}

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

export type DeepFocusHandle = {
  start: () => void;
  openMusic: () => void;
};

export const DeepFocus = forwardRef<DeepFocusHandle, {
  G: string; G2: string;
  onComplete: (tier: FocusTier, lockMode: LockMode, apps: string[]) => Promise<number | null>;
  onMusicReward?: (coins: number, minutes: number) => void;
  hasPaidAccess: boolean;
  onLocked: () => void;
}>(function DeepFocus({ G, G2, onComplete, onMusicReward, hasPaidAccess, onLocked }, ref) {
  const CARD = cardStyle(G);
  const [phase, setPhase] = useState<Phase>("idle");
  const [tier, setTier] = useState<FocusTier | null>(null);
  const [lockMode, setLockMode] = useState<LockMode>("strict");
  const [blocked, setBlocked] = useState<string[]>(QUICK_BLOCK_APPS.map(app => app.name));
  const [custom, setCustom] = useState("");
  const [customApps, setCustomApps] = useState<string[]>([]);
  const [showAppPicker, setShowAppPicker] = useState(false);
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

  const allApps = [...QUICK_BLOCK_APPS.map(app => app.name), ...customApps];

  const addCustomApp = () => {
    const value = custom.trim();
    if (!value || allApps.some(app => app.toLowerCase() === value.toLowerCase())) return;
    setCustomApps(previous => [...previous, value]);
    setBlocked(previous => [...previous, value]);
    setCustom("");
    setShowAppPicker(false);
  };

  const removeCustomApp = (app: string) => {
    setCustomApps(previous => previous.filter(item => item !== app));
    setBlocked(previous => previous.filter(item => item !== app));
  };

  useImperativeHandle(ref, () => ({
    start: () => {
      if (!hasPaidAccess) { onLocked(); return; }
      const defaultTier = FOCUS_TIERS[0];
      if (!defaultTier) return;
      setTier(defaultTier);
      setPhase("setup");
    },
    openMusic: () => setShowMusic(true),
  }), [hasPaidAccess, onLocked]);

  /* ---------------- IDLE: tier picker ---------------- */
  if (phase === "idle") {
    return (
      <section className="home-focus-card" style={{ ...CARD }}>
        <div className="home-section-heading">
          <span><LockKeyhole size={18} strokeWidth={1.8} /></span>
          <div><h2>Deep Focus System</h2><p>Lock distractions. Enter the work.</p></div>
        </div>
        {showMusic && <FocusMusicPanel onClose={() => setShowMusic(false)} onReward={onMusicReward} />}
        <div className="home-focus-tiers">
          {FOCUS_TIERS.map(t => (
            <button key={t.id} onClick={() => { if (!hasPaidAccess) { onLocked(); return; } setTier(t); setPhase("setup"); }}>
              <Clock3 size={16} strokeWidth={1.8} />
              <strong>{t.label}</strong>
              <span>{t.sub}</span>
              <b>+{t.reward} coins</b>
              <small>+{t.reward} leaderboard pts</small>
            </button>
          ))}
        </div>
        {penalty > 0 && <div className="home-focus-penalty">Last session abandoned · −{penalty} pts</div>}
        <button className="home-focus-configure" onClick={() => {
          if (!hasPaidAccess) { onLocked(); return; }
          const defaultTier = FOCUS_TIERS[0];
          if (!defaultTier) return;
          setTier(defaultTier);
          setPhase("setup");
        }}>
          <LockKeyhole size={17} strokeWidth={2} /> Configure Lock <ChevronRight size={16} />
        </button>
        <button className="home-focus-music-link" onClick={() => setShowMusic(true)}>
          <Music2 size={16} /> Focus music <ChevronRight size={16} />
        </button>
      </section>
    );
  }

  /* ---------------- SETUP: app locking modal ---------------- */
  if (phase === "setup" && tier) {
    return (
      <div className="df-overlay df-grid">
        <section className="df-setup" aria-label="Lock setup">
          <header className="df-setup__header">
            <div><span>DEEP FOCUS PROTOCOL</span><h2>LOCK SETUP</h2></div>
            <button className="df-icon-button" aria-label="Close lock setup" onClick={() => { setPhase("idle"); setTier(null); }}><X size={18} /></button>
          </header>
          <div className="df-reward-rail"><Zap size={13} /><strong>{tier.label}</strong><i />+{tier.reward} COINS<i />+{tier.reward} LEADERBOARD PTS</div>

          <div className="df-section-label"><span>01</span> SELECT DURATION</div>
          <div className="df-duration-tabs">
            {FOCUS_TIERS.map(option => <button key={option.id} className={option.id === tier.id ? "is-active" : ""} onClick={() => setTier(option)}><strong>{option.label}</strong><small>{option.sub}</small></button>)}
          </div>

          <div className="df-section-label"><span>02</span> LOCK MODE</div>
          <div className="df-mode-grid">
            {([
              { id: "strict" as LockMode, t: "PERMANENT STRICT", d: "No exit. Zero mercy." },
              { id: "flex" as LockMode, t: "FLEXIBLE FOCUS", d: "Emergency exit · -5 pts" },
            ]).map(m => (
              <button key={m.id} className={lockMode === m.id ? "is-active" : ""} onClick={() => setLockMode(m.id)}>
                <span><Shield size={15} />{lockMode === m.id ? "SELECTED" : "AVAILABLE"}</span>
                <strong>{m.t}</strong><small>{m.d}</small>
              </button>
            ))}
          </div>

          <div className="df-block-heading"><div className="df-section-label"><span>03</span> SELECT APPS TO BLOCK</div><b>{blocked.length} LOCKED</b></div>
          <div className="df-quick-apps">
            {QUICK_BLOCK_APPS.map(app => {
              const on = blocked.includes(app.name);
              return (
                <button key={app.name} className={`df-quick-app ${on ? "is-on" : ""}`} onClick={() => toggleApp(app.name)} aria-pressed={on}>
                  <span className="df-quick-app__icon"><BrandIcon path={app.icon.path} title={`${app.name} icon`} /></span>
                  <strong>{app.name}</strong>
                  <span className="df-toggle" aria-hidden="true"><i /></span>
                </button>
              );
            })}
          </div>

          {customApps.length > 0 && (
            <div className="df-selected-apps" aria-label="Selected extra apps">
              {customApps.map(app => (
                <span key={app} className="df-app-chip">
                  <i aria-hidden="true">{app.slice(0, 1).toUpperCase()}</i>
                  <b>{app}</b>
                  <button aria-label={`Remove ${app}`} onClick={() => removeCustomApp(app)}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}

          <button className="df-choose-apps" onClick={() => setShowAppPicker(true)}><Plus size={17} />Choose Apps or Games to Block</button>

          {showAppPicker && (
            <div className="df-picker-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowAppPicker(false); }}>
              <section className="df-app-picker" role="dialog" aria-modal="true" aria-labelledby="df-app-picker-title">
                <header><div><span>PERSONAL BLOCK LIST</span><h3 id="df-app-picker-title">Choose an app or game</h3></div><button aria-label="Close app picker" onClick={() => setShowAppPicker(false)}><X size={18} /></button></header>
                <form onSubmit={event => { event.preventDefault(); addCustomApp(); }}>
                  <label><Search size={17} /><input autoFocus value={custom} onChange={event => setCustom(event.target.value)} placeholder="Search or enter any app or game" aria-label="App or game name" /></label>
                  <p>Type the exact app or game you want blocked for this session.</p>
                  <button type="submit" disabled={!custom.trim()}><Plus size={16} />Add to block list</button>
                </form>
              </section>
            </div>
          )}

          <div className="df-block-summary"><Shield size={15} /><span><strong>{blocked.length} APPS</strong> shielded for {tier.label.toLowerCase()}</span><b>{lockMode === "strict" ? "NO EXIT" : "−5 EXIT"}</b></div>
          <button className="df-start-lock" onClick={confirmLock}><span><LockKeyhole size={18} /></span><strong>CONFIRM &amp; LOCK SESSION</strong><small>BIOMETRIC FOCUS SEAL</small></button>
        </section>
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
      <div className="df-overlay df-active df-grid">
        <main className="df-active__inner">
          <div className={`df-status-bar ${lockMode === "strict" ? "is-strict" : ""}`}><Shield size={14} /><span>{lockMode === "strict" ? "STRICT APP LOCK ENFORCED" : "FLEXIBLE FOCUS ACTIVE"}</span><b>LIVE</b></div>
          <div className="df-active__meta">{blocked.length} APPS BLOCKED <i /> {tier.sub}</div>

          <div className="df-focus-core">
            <div className="df-timer-ring">
              <svg viewBox="0 0 180 180">
                <circle cx="90" cy="90" r={R} className="df-timer-ring__track" />
                <circle cx="90" cy="90" r={R} className="df-timer-ring__progress" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
              </svg>
              <div className="df-timer-ring__center"><span>TIME REMAINING</span><strong>{fmt(left)}</strong><small>{Math.round(pct * 100)}% COMPLETE</small></div>
            </div>

            <div className="df-mentor"><div className="df-mentor__image"><img src={eagleMentor.url} alt="Eagle mentor watching your focus session" /><i /><span>MENTOR MODE</span></div><strong>◉ EYES ON YOU</strong><p>{MENTOR_LINES[Math.floor(left / 15) % MENTOR_LINES.length]}</p></div>
            </div>

          <div className="df-reward-grid">
            <div><span>SESSION REWARD</span><strong>+{tier.reward}</strong><small>COINS PENDING</small></div>
            <div><span>DISCIPLINE SCORE</span><strong>+{tier.reward}</strong><small>LEADERBOARD PTS</small></div>
          </div>

          <section className="df-frequency">
            <button className="df-frequency__header" onClick={() => setShowAudio(s => !s)}>
              <span><Music2 size={16} /><i><strong>FREQUENCY HUB</strong><small>CURRENT SONG · {track.name}</small></i></span><b>{showAudio ? "−" : "+"}</b>
            </button>
            {showAudio && (
              <div className="df-frequency__body">
                {TRACKS.map((t, i) => (
                  <button key={t.id} className={`df-track ${i === trackIdx ? "is-active" : ""}`} onClick={() => setTrackIdx(i)}><span><strong>{t.name}</strong><small className={missing[t.id] ? "is-error" : ""}>{missing[t.id] ? "TRACK UNAVAILABLE" : t.tag}</small></span><i>{i === trackIdx ? "PLAYING" : two(i + 1)}</i></button>
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
                  className="df-audio"
                />
                <div className="df-audio-controls">
                  <button className={loop ? "is-active" : ""} onClick={() => setLoop(l => !l)}><Repeat2 size={14} /> LOOP {loop ? "ON" : "OFF"}</button>
                  <Volume2 size={14} /><span>VOL</span><input aria-label="Frequency Hub volume" type="range" min={0} max={1} step={0.01} value={vol} onChange={e => setVol(Number(e.target.value))} />
                </div>
              </div>
            )}
          </section>

          <footer className="df-lock-footer">
            {lockMode === "strict" ? (
              <div><LockKeyhole size={15} /><span><strong>STRICT LOCK — NO EXIT</strong><small>DISCIPLINE IS DOING IT WHEN YOU DON'T FEEL LIKE IT.</small></span></div>
            ) : (
              <button onClick={abandon}>⚠ EMERGENCY OVERRIDE · -5 PTS</button>
            )}
          </footer>
        </main>
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
});
