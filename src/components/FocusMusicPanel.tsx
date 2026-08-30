import { useEffect, useRef, useState } from "react";
import { AX } from "@/tabs/styles";
import { X, Play, Pause, Music2 } from "lucide-react";

import beta14 from "@/assets/audio/beta14.mp3.asset.json";
import pure40 from "@/assets/audio/pure40.mp3.asset.json";
import battleWave from "@/assets/audio/battlewave.mp3.asset.json";

const TRACKS = [
  { id: "beta14", name: "14Hz Beta · Study Melody", sub: "Deep focus & concentration", src: beta14.url },
  { id: "pure40", name: "40Hz Pure Binaural", sub: "Focus · memory · clarity", src: pure40.url },
  { id: "battle", name: "Battle Wave", sub: "High-intensity war mode", src: battleWave.url },
];

const DURATIONS = [
  { m: 30, label: "30 min" },
  { m: 60, label: "1 hr" },
  { m: 120, label: "2 hr" },
  { m: 180, label: "3 hr" },
];

const two = (n: number) => String(n).padStart(2, "0");
const fmt = (s: number) => `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;

export function FocusMusicPanel({ onClose }: { onClose: () => void }) {
  const [trackId, setTrackId] = useState(TRACKS[0]!.id);
  const [minutes, setMinutes] = useState(30);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(30 * 60);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const track = TRACKS.find(t => t.id === trackId)!;

  useEffect(() => { if (!running) setLeft(minutes * 60); }, [minutes, running]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft(s => {
        if (s <= 1) {
          clearInterval(id);
          audioRef.current?.pause();
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (running) { a.pause(); setRunning(false); return; }
    if (left <= 0) setLeft(minutes * 60);
    try { await a.play(); setRunning(true); } catch { /* ignore */ }
  };

  const pickTrack = (id: string) => {
    setTrackId(id);
    setRunning(false);
    audioRef.current?.pause();
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 400,
      background: "rgba(6,6,12,0.82)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 440, maxHeight: "88vh", overflowY: "auto",
        background: AX.surface, border: `1px solid ${AX.border}`,
        borderRadius: `${AX.radius}px ${AX.radius}px 0 0`, padding: 18,
        fontFamily: AX.font,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Music2 size={18} strokeWidth={1.8} color={AX.accent} />
          <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: AX.text }}>Focus music</div>
          <button onClick={onClose} aria-label="Close music panel" style={{
            background: "transparent", border: "none", color: AX.muted, cursor: "pointer", padding: 4,
          }}><X size={18} strokeWidth={2} /></button>
        </div>

        <div style={{ fontSize: 13, color: AX.muted, marginBottom: 8 }}>Timer</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 18 }}>
          {DURATIONS.map(d => {
            const active = minutes === d.m;
            return (
              <button key={d.m} onClick={() => setMinutes(d.m)} style={{
                padding: "12px 4px", cursor: "pointer", borderRadius: AX.radiusSm,
                background: active ? AX.accent : "#181820",
                border: `1px solid ${active ? AX.accent : AX.border}`,
                color: active ? "#FFFFFF" : AX.text,
                fontFamily: AX.font, fontSize: 13, fontWeight: 600,
              }}>{d.label}</button>
            );
          })}
        </div>

        <div style={{ fontSize: 13, color: AX.muted, marginBottom: 8 }}>Track</div>
        {TRACKS.map(t => {
          const active = t.id === trackId;
          return (
            <div key={t.id} onClick={() => pickTrack(t.id)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              marginBottom: 8, cursor: "pointer", borderRadius: AX.radiusSm,
              background: "#181820",
              border: `1px solid ${active ? AX.accent : AX.border}`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: active ? AX.text : AX.text }}>{t.name}</div>
                <div style={{ fontSize: 12, color: AX.muted, marginTop: 2 }}>{t.sub}</div>
              </div>
              {active && <div style={{ width: 8, height: 8, borderRadius: "50%", background: AX.accent }} />}
            </div>
          );
        })}

        <div style={{
          marginTop: 16, textAlign: "center", padding: "16px 0 4px",
        }}>
          <div style={{ fontSize: 34, fontWeight: 600, color: AX.text, fontVariantNumeric: "tabular-nums" }}>{fmt(left)}</div>
          <div style={{ fontSize: 12, color: AX.muted, marginBottom: 14 }}>
            {running ? "Playing · loops until timer ends" : left === 0 ? "Session complete" : "Ready"}
          </div>
          <button onClick={toggle} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 26px", cursor: "pointer", borderRadius: 12,
            background: AX.accent, border: `1px solid ${AX.accent}`, color: "#FFFFFF",
            fontFamily: AX.font, fontSize: 14, fontWeight: 600,
          }}>
            {running ? <Pause size={16} strokeWidth={2} /> : <Play size={16} strokeWidth={2} />}
            {running ? "Pause" : "Start"}
          </button>
        </div>

        <audio ref={audioRef} src={track.src} loop preload="none" />
      </div>
    </div>
  );
}
