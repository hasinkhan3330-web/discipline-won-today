import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle, LockKeyhole, Music2, Repeat2, Shield, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import type { ContractRow } from "@/lib/verified/contracts";
import { endContractSession, type SessionSnapshot } from "@/lib/verified/contract-session";

// Reuses the exact same audio assets and df-* styles as Deep Focus (read-only there).
import gamma40 from "@/assets/audio/gamma40.mp3.asset.json";
import alpha8d from "@/assets/audio/alpha8d.mp3.asset.json";
import solfeggio528 from "@/assets/audio/solfeggio528.mp3.asset.json";
import zen432 from "@/assets/audio/zen432.mp3.asset.json";
import focusMatrix from "@/assets/audio/focusmatrix.mp3.asset.json";
import battleWave from "@/assets/audio/battlewave.mp3.asset.json";
import eagleMentor from "@/assets/eagle-mentor.jpg.asset.json";

const TRACKS = [
  { id: 1, name: "40Hz GAMMA + BROWN NOISE", tag: "10:00 · PURE BINAURAL", src: gamma40.url },
  { id: 2, name: "BINAURAL ALPHA WAVES 8D", tag: "09:50 · ALPHA FLOW", src: alpha8d.url },
  { id: 3, name: "528Hz HEALING + NATURE", tag: "07:16 · SOLFEGGIO", src: solfeggio528.url },
  { id: 4, name: "432Hz ZEN STRESS RELIEF", tag: "08:27 · DEEP CALM", src: zen432.url },
  { id: 5, name: "FOCUS MATRIX DEEP HOUSE", tag: "05:32 · STUDY DRIVE", src: focusMatrix.url },
  { id: 6, name: "BATTLE WAVE", tag: "01:52 · WAR MODE", src: battleWave.url },
];

const MENTOR_LINES = [
  "THE EAGLE NEVER BLINKS. NEITHER DO YOU.",
  "ONE SCREEN. ONE MISSION. NO ESCAPE.",
  "PREDATORS FOCUS. PREY SCROLLS.",
  "YOUR ATTENTION IS THE ONLY CURRENCY.",
  "STAY. THE SUMMIT IS CLOSER THAN COMFORT.",
];

const two = (n: number) => String(n).padStart(2, "0");
const fmt = (s: number) => `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;

export type SessionOutcome = "completed" | "ended" | "abandoned";

export function ContractFocusSession({ contract, session, onClose }: {
  contract: ContractRow;
  session: SessionSnapshot;
  onClose: (outcome: SessionOutcome) => void;
}) {
  const [left, setLeft] = useState(() => Math.max(0, Math.round((session.expectedEndAt - Date.now()) / 1000)));
  const [trackIdx, setTrackIdx] = useState(0);
  const [loop, setLoop] = useState(true);
  const [vol, setVol] = useState(0.7);
  const [showAudio, setShowAudio] = useState(false);
  const [missing, setMissing] = useState<Record<number, boolean>>({});
  const [stuck, setStuck] = useState(false);
  const [paused, setPaused] = useState(false);
  const [endingMode, setEndingMode] = useState<null | "end" | "exit">(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const finishing = useRef(false);

  const total = Math.max(1, Math.round((session.expectedEndAt - session.startedAt) / 1000));

  const finish = useCallback(async (why: string, outcome: SessionOutcome) => {
    if (finishing.current) return;
    finishing.current = true;
    setBusy(true);
    audioRef.current?.pause();
    const res = await endContractSession(session.sessionId, why);
    if (!res.ok) {
      finishing.current = false;
      setBusy(false);
      toast.error("Couldn't reach the server. Your session is safe — try again.");
      return;
    }
    haptic("success");
    onClose(outcome);
  }, [session.sessionId, onClose]);

  // Timestamp-only countdown; completes even after backgrounding/kill (checkpoint reconcile reopens or finalizes).
  useEffect(() => {
    const id = setInterval(() => {
      const s = Math.max(0, Math.round((session.expectedEndAt - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) { clearInterval(id); void finish("completed", "completed"); }
    }, 250);
    return () => clearInterval(id);
  }, [session.expectedEndAt, finish]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = vol; }, [vol, trackIdx]);

  const togglePause = () => {
    const a = audioRef.current;
    if (paused) { void a?.play().catch(() => {}); setPaused(false); }
    else { a?.pause(); setPaused(true); }
  };

  const pct = Math.min(1, (total - left) / total);
  const R = 74, C = 2 * Math.PI * R;
  const track = TRACKS[trackIdx]!;

  return (
    <div className="df-overlay df-active df-grid">
      <main className="df-active__inner">
        <div className="df-status-bar"><Shield size={14} /><span>CONTRACT SESSION ACTIVE</span><b>LIVE</b></div>
        <div className="df-active__meta">{contract.title.toUpperCase()}</div>

        <div className="df-focus-core">
          <div className="df-timer-ring">
            <svg viewBox="0 0 180 180">
              <circle cx="90" cy="90" r={R} className="df-timer-ring__track" />
              <circle cx="90" cy="90" r={R} className="df-timer-ring__progress" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
            </svg>
            <div className="df-timer-ring__center"><span>TIME REMAINING</span><strong>{fmt(left)}</strong><small>{Math.round(pct * 100)}% COMPLETE</small></div>
          </div>
          <div className="df-mentor"><div className="df-mentor__image"><img src={eagleMentor.url} alt="Eagle mentor watching your contract session" /><i /><span>MENTOR MODE</span></div><strong>◉ EYES ON YOU</strong><p>{MENTOR_LINES[Math.floor(left / 15) % MENTOR_LINES.length]}</p></div>
        </div>

        {contract.trigger_text && (
          <div className="df-block-summary"><Shield size={15} /><span><strong>TRIGGER</strong> {contract.trigger_text}</span></div>
        )}

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

        {stuck && (
          <div className="df-block-summary" style={{ marginTop: 10 }}>
            <HelpCircle size={15} />
            <span><strong>STUCK IS NORMAL.</strong> Shrink it: do the smallest next step for 2 minutes. The clock keeps running — you're still in.</span>
            <button aria-label="Dismiss" onClick={() => setStuck(false)} style={{ background: "none", border: 0, color: "inherit", cursor: "pointer" }}><X size={14} /></button>
          </div>
        )}

        {endingMode && (
          <div className="df-picker-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !busy) setEndingMode(null); }}>
            <section className="df-app-picker" role="dialog" aria-modal="true" aria-label={endingMode === "end" ? "End session" : "Emergency exit"}>
              <header>
                <div><span>{endingMode === "end" ? "END SESSION" : "EMERGENCY EXIT"}</span>
                  <h3>{endingMode === "end" ? "End this session early?" : "Leave right now?"}</h3></div>
                <button aria-label="Close" onClick={() => setEndingMode(null)} disabled={busy}><X size={18} /></button>
              </header>
              <form onSubmit={e => {
                e.preventDefault();
                if (busy) return;
                const why = endingMode === "end" ? `ended_early: ${reason.trim() || "no reason given"}` : "emergency_exit";
                void finish(why, endingMode === "end" ? "ended" : "abandoned");
              }}>
                <p>{endingMode === "end"
                  ? "The session ends and your contract moves on. Tell yourself why — one short line."
                  : "You are never trapped. The session closes as abandoned; your contract stays active so you can restart."}</p>
                {endingMode === "end" && (
                  <label><input value={reason} onChange={e => setReason(e.target.value)} maxLength={200} placeholder="Reason (optional)" aria-label="Reason for ending early" /></label>
                )}
                <button type="submit" disabled={busy}><AlertTriangle size={16} />{busy ? "Saving…" : endingMode === "end" ? "Confirm end session" : "Confirm emergency exit"}</button>
              </form>
            </section>
          </div>
        )}

        <footer className="df-lock-footer" style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={() => setStuck(s => !s)}><HelpCircle size={15} /> I'M STUCK</button>
            <button onClick={togglePause}><Music2 size={15} /> {paused ? "RESUME SOUND" : "PAUSE SOUND"}</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={() => { setReason(""); setEndingMode("end"); }} disabled={busy}><LockKeyhole size={15} /> END SESSION</button>
            <button onClick={() => setEndingMode("exit")} disabled={busy}><AlertTriangle size={15} /> EMERGENCY EXIT</button>
          </div>
        </footer>
      </main>
    </div>
  );
}
