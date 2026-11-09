import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, FlaskConical, Grid2x2, Keyboard, Smartphone, X } from "lucide-react";
import { MISSION_META, isNewMission, LEVEL_LABEL, type Level, type MissionMode, type NewMission } from "@/lib/wake-missions/rules";
import { MissionRunner } from "./MissionRunner";
import styles from "./missions.module.css";

/** True unless the browser has no motion API, or a non-iOS device never reports motion data. */
export function useMotionSupport(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof DeviceMotionEvent === "undefined") { setOk(false); return; }
    if (typeof (DeviceMotionEvent as unknown as { requestPermission?: unknown }).requestPermission === "function") { setOk(true); return; }
    let seen = false;
    const on = (e: DeviceMotionEvent) => { if ((e.accelerationIncludingGravity?.x ?? e.acceleration?.x) != null) { seen = true; setOk(true); } };
    window.addEventListener("devicemotion", on);
    const t = window.setTimeout(() => { if (!seen) setOk(false); }, 1500);
    return () => { window.removeEventListener("devicemotion", on); clearTimeout(t); };
  }, []);
  return ok;
}

const MathGlyph = () => <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M3 13h9M7.5 8.5v9M15 9l7 7M22 9l-7 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" /></svg>;
const ROWS: { id: MissionMode; name: string; icon: JSX.Element; purple?: boolean }[] = [
  { id: "math", name: "Math", icon: <MathGlyph /> },
  { id: "science", name: "Science", icon: <FlaskConical size={24} /> },
  { id: "shake", name: "Shake", icon: <Smartphone size={24} />, purple: true },
  { id: "typing", name: "Typing", icon: <Keyboard size={24} /> },
  { id: "tiles", name: "Find Color Tiles", icon: <Grid2x2 size={24} /> },
];

export function MissionPicker({ mode, onMode, difficulty, onDifficulty, rounds, onRounds }: {
  mode: MissionMode; onMode: (m: MissionMode) => void;
  difficulty: number; onDifficulty: (d: Level) => void;
  rounds: number; onRounds: (r: number) => void;
}) {
  const motion = useMotionSupport();
  const [sheet, setSheet] = useState<NewMission | null>(null);
  const [trial, setTrial] = useState<NewMission | null>(null);
  const lvl = (Math.min(3, Math.max(1, difficulty)) as Level);
  return <div className={styles.root}>
    <div className={styles.picker} role="radiogroup" aria-label="Choose a wake-up mission">
      <p className={styles.pickerTitle}>Choose a wake-up mission</p>
      {ROWS.map(r => {
        const off = r.id === "shake" && motion === false;
        return <button key={r.id} type="button" role="radio" aria-checked={mode === r.id} disabled={off} className={styles.row}
          onClick={() => (isNewMission(r.id) ? setSheet(r.id) : onMode(r.id))}>
          <span className={`${styles.tile} ${r.purple ? styles.tilePurple : ""}`}>{r.icon}</span>
          <span className={styles.rowName}>{r.name}{off && <small>Not supported on this device</small>}</span>
          {mode === r.id ? <Check className={styles.check} size={20} aria-hidden="true" /> : isNewMission(r.id) && !off && <span className={styles.newChip}>New</span>}
        </button>;
      })}
      {isNewMission(mode) && <div className={styles.settings}>
        <span className={styles.settingsLabel}>Difficulty</span>
        <div className={styles.seg}>{([1, 2, 3] as Level[]).map(l => <button key={l} type="button" aria-pressed={lvl === l} onClick={() => onDifficulty(l)}>{LEVEL_LABEL[l]}</button>)}</div>
        <span className={styles.settingsLabel}>Rounds</span>
        <div className={styles.seg}>{[1, 2, 3].map(n => <button key={n} type="button" aria-pressed={rounds === n} onClick={() => onRounds(n)}>{n}</button>)}</div>
        <button type="button" className={styles.ghost} onClick={() => setTrial(mode)}>Try it</button>
      </div>}
    </div>
    {sheet && createPortal(<div className={`${styles.root} ${styles.backdrop}`} onClick={() => setSheet(null)}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={MISSION_META[sheet].name} onClick={e => e.stopPropagation()}>
        <div className={styles.handle} aria-hidden="true" />
        <span className={styles.chip}>{MISSION_META[sheet].name}</span>
        <h2 className={styles.headline}>{MISSION_META[sheet].headline.split(". ").map((l, i, a) => <span key={i} style={{ display: "block" }}>{l}{i < a.length - 1 ? "." : ""}</span>)}</h2>
        <div className={styles.demo} aria-hidden="true">{sheet === "shake" ? <div className={styles.demoPhone} /> : sheet === "typing" ? <div className={styles.demoType}>Wake your mind first</div> : <div className={styles.demoGrid}>{Array.from({ length: 16 }, (_, i) => <i key={i} />)}</div>}</div>
        <button type="button" className={styles.next} onClick={() => { onMode(sheet); setSheet(null); }}>Next</button>
        <button type="button" className={styles.ghost} onClick={() => { setTrial(sheet); }}>Try it</button>
      </div>
    </div>, document.body)}
    {trial && createPortal(<div className={`${styles.root} ${styles.preview}`} role="dialog" aria-modal="true" aria-label={`${MISSION_META[trial].name} preview`}>
      <div className={styles.previewTop}><span>PREVIEW · no sound · no rewards</span><button type="button" className={styles.ghost} style={{ width: "auto", padding: "0 16px" }} onClick={() => setTrial(null)} aria-label="Close preview"><X size={18} /></button></div>
      <MissionRunner challenge={{ mission: trial, difficulty: lvl, rounds }} onComplete={() => setTrial(null)} />
    </div>, document.body)}
  </div>;
}
