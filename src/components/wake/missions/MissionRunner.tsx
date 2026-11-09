import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, Smartphone } from "lucide-react";
import {
  createShakeCounter, sampleFromMotion, shakeProgress, SHAKE_TARGET, LEVEL_LABEL, MISSION_META,
  acceptTypingInput, letterStates, typingComplete, caseSensitive, pickSentence,
  newTileState, tapTile, roundCleared, type Level, type MissionChallenge, type MissionProof, type TileState,
} from "@/lib/wake-missions/rules";
import { SENTENCES, type MissionLang } from "@/lib/wake-missions/sentences";
import styles from "./missions.module.css";

const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };
type Props = { challenge: MissionChallenge; onComplete: (proof: MissionProof) => void; busy?: boolean; preview?: boolean };

/** Renders one of the three new missions. Parent decides whether this is a live alarm or a preview. */
export function MissionRunner(props: Props) {
  const { challenge } = props;
  return <div className={`${styles.root} ${styles.screen}`}>
    <div className={styles.mHead}>
      <p className={styles.mName}>{MISSION_META[challenge.mission].name}</p>
      <span className={styles.mLevel}>{LEVEL_LABEL[challenge.difficulty]}{challenge.rounds > 1 ? ` · ${challenge.rounds} rounds` : ""}</span>
    </div>
    {challenge.mission === "shake" ? <ShakeMission {...props} /> : challenge.mission === "typing" ? <TypingMission {...props} /> : <TilesMission {...props} />}
  </div>;
}

function useFinish(onComplete: Props["onComplete"]) {
  const started = useRef(performance.now());
  const sent = useRef(false);
  const [done, setDone] = useState(false);
  const finish = (proof: Omit<MissionProof, "elapsed_ms">) => {
    if (sent.current) return;
    sent.current = true; setDone(true); buzz([80, 40, 160]);
    const elapsed_ms = Math.round(performance.now() - started.current);
    window.setTimeout(() => onComplete({ ...proof, elapsed_ms }), 700);
  };
  return { done, finish };
}

type MotionPerm = { requestPermission?: () => Promise<"granted" | "denied"> };
function ShakeMission({ challenge, onComplete }: Props) {
  const target = SHAKE_TARGET[challenge.difficulty] * challenge.rounds;
  const needsPerm = typeof DeviceMotionEvent !== "undefined" && typeof (DeviceMotionEvent as unknown as MotionPerm).requestPermission === "function";
  const [state, setState] = useState<"idle" | "listening" | "denied" | "lost" | "unsupported">(typeof DeviceMotionEvent === "undefined" ? "unsupported" : needsPerm ? "idle" : "listening");
  const [count, setCount] = useState(0);
  const counter = useMemo(() => createShakeCounter(challenge.difficulty), [challenge.difficulty]);
  const { done, finish } = useFinish(onComplete);
  const lastEvent = useRef(0);
  useEffect(() => {
    if (state !== "listening") return;
    lastEvent.current = performance.now();
    const onMotion = (e: DeviceMotionEvent) => {
      const s = sampleFromMotion(e, e.timeStamp || performance.now());
      if (!s) return;
      lastEvent.current = performance.now();
      const n = counter.push(s); setCount(n);
      if (n >= target) finish({ shakes: n });
    };
    window.addEventListener("devicemotion", onMotion);
    const watch = window.setInterval(() => { if (performance.now() - lastEvent.current > 4000 && counter.count < target) setState("lost"); }, 1000);
    return () => { window.removeEventListener("devicemotion", onMotion); clearInterval(watch); };
  }, [state, counter, target]); // eslint-disable-line react-hooks/exhaustive-deps
  const grant = async () => {
    try {
      const p = (DeviceMotionEvent as unknown as MotionPerm).requestPermission;
      const r = p ? await p() : "granted";
      setState(r === "granted" ? "listening" : "denied");
    } catch { setState("denied"); }
  };
  const pct = Math.round(shakeProgress(count, target) * 100);
  if (done) return <div className={styles.done} role="status" aria-label="Mission complete"><Check size={72} strokeWidth={3} /></div>;
  if (state === "unsupported") return <p className={styles.err} role="alert">Motion sensor not available on this device. The alarm keeps ringing. Open the app on your phone to finish this mission.</p>;
  if (state !== "listening") return <div className={styles.screen}>
    <Smartphone size={48} style={{ justifySelf: "center" }} aria-hidden="true" />
    <p className={styles.msg}>{state === "idle" ? "Tap to start. Your phone will ask for motion access." : state === "denied" ? "Motion access needed. Allow it to stop the alarm." : "Motion access needed. We stopped receiving movement."}</p>
    <button type="button" className={styles.next} onClick={() => { if (state === "lost" && !needsPerm) setState("listening"); else void grant(); }}>{state === "idle" ? "Start shaking" : "Allow motion access"}</button>
  </div>;
  return <>
    <div className={`${styles.meter} ${pct >= 100 ? styles.flash : ""}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Shake progress">
      <div className={styles.meterFill} style={{ height: `${pct}%` }} />
      <div className={styles.meterLabel}>{pct}%<small>Keep shaking</small></div>
    </div>
    <p className={styles.msg}>{count} / {target} shakes</p>
  </>;
}

function TypingMission({ challenge, onComplete, preview }: Props) {
  const sentences = useMemo(() => {
    // Live alarms use only server-issued sentences; the local bank (same source as the server table) is preview-only.
    if (challenge.sentences?.length) return challenge.sentences;
    if (!preview) return [];
    const lang: MissionLang = typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("hi") ? "hi" : "en";
    const used: string[] = [];
    return Array.from({ length: challenge.rounds }, () => { const s = pickSentence(SENTENCES[lang][challenge.difficulty], used); used.push(s); return s; });
  }, [challenge, preview]);
  const [round, setRound] = useState(0);
  const [typed, setTyped] = useState("");
  const [done_, setDoneTexts] = useState<string[]>([]);
  const [warn, setWarn] = useState("");
  const { done, finish } = useFinish(onComplete);
  const input = useRef<HTMLInputElement>(null);
  const lastType = useRef<string | undefined>(undefined);
  const target = sentences[round] ?? "";
  useEffect(() => { input.current?.focus(); }, [round]);
  const change = (e: FormEvent<HTMLInputElement>) => {
    const next = e.currentTarget.value;
    if (!acceptTypingInput(typed, next, lastType.current)) { e.currentTarget.value = typed; setWarn("Type it yourself — paste and dictation are blocked."); return; }
    setWarn(""); setTyped(next);
    if (typingComplete(next, target, challenge.difficulty)) {
      const all = [...done_, next];
      if (round + 1 >= sentences.length) finish({ typed: all });
      else { setDoneTexts(all); setRound(round + 1); setTyped(""); buzz(40); }
    }
  };
  const states = letterStates(typed, target, challenge.difficulty);
  if (done) return <div className={styles.done} role="status" aria-label="Mission complete"><Check size={72} strokeWidth={3} /></div>;
  if (!sentences.length) return <p className={styles.err} role="alert">Loading your sentence from the server… The alarm keeps ringing.</p>;
  return <>
    {sentences.length > 1 && <p className={styles.mLevel}>{round + 1}/{sentences.length}</p>}
    <div className={styles.card} aria-label={`Type: ${target}`}>{[...target].map((ch, i) => <span key={i} className={styles[states[i]!]}>{ch}</span>)}</div>
    <div className={styles.bar} aria-hidden="true"><i style={{ width: `${Math.min(100, typed.length / Math.max(1, target.length) * 100)}%` }} /></div>
    <input ref={input} className={styles.typeInput} aria-label="Type the sentence" value={typed} autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} inputMode="text" enterKeyHint="done"
      onBeforeInput={e => { lastType.current = (e.nativeEvent as InputEvent).inputType; }}
      onPaste={e => { e.preventDefault(); setWarn("Paste is blocked."); }} onDrop={e => e.preventDefault()} onCut={e => e.preventDefault()}
      onChange={change} />
    <p className={styles.msg} role="status">{warn || (caseSensitive(challenge.difficulty) ? "Case and punctuation must match." : "Capital letters don't matter.")}</p>
  </>;
}

function TilesMission({ challenge, onComplete }: Props) {
  const lvl: Level = challenge.difficulty;
  const [round, setRound] = useState(0);
  const [s, setS] = useState<TileState>(() => newTileState(lvl));
  const [wrongCell, setWrongCell] = useState<number | null>(null);
  const [cleared, setCleared] = useState(false);
  const totals = useRef({ taps: 0, targets: 0 });
  const { done, finish } = useFinish(onComplete);
  const tap = (i: number) => {
    if (cleared || done) return;
    const r = tapTile(s, i, lvl);
    if (r.hit) buzz(20);
    else if (!s.cleared.includes(i)) { buzz([60, 40, 60]); setWrongCell(i); window.setTimeout(() => setWrongCell(null), 350); }
    setS(r.state);
    if (r.hit && roundCleared(r.state)) {
      totals.current = { taps: totals.current.taps + r.state.taps, targets: totals.current.targets + r.state.round.targets.length };
      setCleared(true);
      window.setTimeout(() => {
        if (round + 1 >= challenge.rounds) finish(totals.current);
        else { setRound(round + 1); setS(newTileState(lvl)); setCleared(false); }
      }, 800);
    }
  };
  if (done) return <div className={`${styles.done} ${styles.doneOk}`} role="status" aria-label="Mission complete"><Check size={72} strokeWidth={3} /></div>;
  return <>
    <p className={styles.mLevel}>Round {round + 1}/{challenge.rounds}</p>
    <span className={styles.findChip}>Find <i style={{ background: s.round.target }} aria-label={`${s.round.name} tiles`} /> {s.round.targets.length - s.cleared.length} left</span>
    <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${s.round.size}, 1fr)` }}>
      {Array.from({ length: s.round.size ** 2 }, (_, i) => {
        const isT = s.round.targets.includes(i), gone = s.cleared.includes(i);
        return <button key={`${s.regenerated}-${round}-${i}`} type="button" className={`${styles.cell} ${gone ? styles.cleared : ""} ${wrongCell === i ? styles.wrong : ""}`} style={{ background: isT ? s.round.target : s.round.base }} aria-label={gone ? "Cleared" : `Tile ${i + 1}`} onClick={() => tap(i)} />;
      })}
    </div>
    <p className={styles.msg} role="status">{cleared ? "All clear!" : s.wrong ? `${s.wrong}/3 wrong — 3 makes a new layout` : "Tap every highlighted tile."}</p>
  </>;
}
