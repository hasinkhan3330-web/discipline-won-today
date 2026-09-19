import { useEffect, useMemo, useRef, useState } from "react";
import {
  Coins,
  Gauge,
  HeartPulse,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Volume2,
  Waves,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NeuralWaveCanvas, type BreathPhase, type WavePreset } from "@/components/NeuralWaveCanvas";
import { haptic } from "@/lib/haptics";
import manifestation from "@/assets/audio/deep-manifestation.mp3.asset.json";
import stillness852 from "@/assets/audio/852hz-stillness.mp3.asset.json";
import higherSelf from "@/assets/audio/higher-self-alpha.mp3.asset.json";
import spiritual10 from "@/assets/audio/spiritual-guide-10.mp3.asset.json";
import spiritual15 from "@/assets/audio/spiritual-guide-15.mp3.asset.json";
import thetaWaves from "@/assets/audio/theta-waves.mp3.asset.json";
import tibetanBowls from "@/assets/audio/tibetan-bowls.mp3.asset.json";

const TRACKS = [
  { id: "manifestation", title: "Deep Manifestation", subtitle: "Theta textures · rain particles", frequency: "Theta Calm", src: manifestation.url },
  { id: "stillness-852", title: "852 Hz Stillness", subtitle: "Soft harmonic textures", frequency: "Alpha Flow", src: stillness852.url },
  { id: "higher-self", title: "Higher Self", subtitle: "Layered ambient current", frequency: "Alpha Flow", src: higherSelf.url },
  { id: "spiritual-10", title: "Spiritual Guide", subtitle: "Slow atmospheric drift", frequency: "Theta Calm", src: spiritual10.url },
  { id: "spiritual-15", title: "Spiritual Guide II", subtitle: "Extended ambient drift", frequency: "Theta Calm", src: spiritual15.url },
  { id: "theta-waves", title: "Relaxing Theta Waves", subtitle: "Low-frequency soundscape", frequency: "Beta Focus", src: thetaWaves.url },
  { id: "tibetan-bowls", title: "Tibetan Singing Bowls", subtitle: "Resonant bowl textures", frequency: "Gamma Clarity", src: tibetanBowls.url },
] as const;

const PHASES: { key: BreathPhase; label: string; tone: string }[] = [
  { key: "inhale", label: "INHALE", tone: "cyan" },
  { key: "holdFull", label: "HOLD", tone: "blue" },
  { key: "exhale", label: "EXHALE", tone: "violet" },
  { key: "holdEmpty", label: "HOLD", tone: "purple" },
];
const PRESETS: { key: WavePreset; label: string }[] = [
  { key: "theta", label: "Theta Calm" }, { key: "alpha", label: "Alpha Flow" },
  { key: "beta", label: "Beta Focus" }, { key: "gamma", label: "Gamma Clarity" },
];

export function ZenTab({ med, coins }: {
  coins?: number;
  med: {
    medMin: number; medLeft: number; medLeftMs: number; medRun: boolean;
    medStatus: "idle" | "running" | "paused" | "complete";
    medSessions: number; medTotal: number;
    elapsedMs: number; getElapsedMs: () => number;
    medPhase: BreathPhase; phaseProgress: number; phaseCountdown: number;
    start: () => void; pause: () => void; restart: () => void;
    pickMed: (m: number) => void;
    fmtT: (s: number) => string;
  };
}) {
  const { medMin, medLeft, medRun, medStatus, medSessions, medTotal, elapsedMs, getElapsedMs, medPhase, phaseProgress, phaseCountdown, start, pause, restart, pickMed, fmtT } = med;
  const [trackIndex, setTrackIndex] = useState(0);
  const [volume, setVolume] = useState(68);
  const [intensity, setIntensity] = useState(68);
  const [haptics, setHaptics] = useState(false);
  const [cues, setCues] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundSheet, setSoundSheet] = useState(false);
  const [settingsSheet, setSettingsSheet] = useState(false);
  const [preset, setPreset] = useState<WavePreset>("theta");
  const lastCuePhase = useRef<BreathPhase | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const track = TRACKS[trackIndex];
  const sessionProgress = Math.min(1, elapsedMs / (medMin * 60_000));
  const phaseIndex = PHASES.findIndex(item => item.key === medPhase);
  const breathScale = medPhase === "inhale" ? 0.76 + phaseProgress * 0.24 : medPhase === "holdFull" ? 1 : medPhase === "exhale" ? 1 - phaseProgress * 0.24 : 0.76;
  const phaseLabel = medPhase === "inhale" ? "INHALE" : medPhase === "exhale" ? "EXHALE" : "HOLD";
  const phaseInstruction = medPhase === "inhale" ? "Breathe in slowly" : medPhase === "exhale" ? "Release slowly" : medPhase === "holdFull" ? "Rest in the stillness" : "Be completely still";
  const quote = useMemo(() => ["Let the noise pass through.", "Return to the quiet center.", "Follow the current within."][new Date().getDate() % 3], []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
  }, [volume]);

  useEffect(() => { if (!medRun) audioRef.current?.pause(); }, [medRun]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!soundEnabled) audio.pause();
    else if (medRun) void audio.play().catch(() => undefined);
  }, [medRun, soundEnabled]);
  useEffect(() => {
    if (!medRun || lastCuePhase.current === medPhase) return;
    lastCuePhase.current = medPhase;
    if (haptics || cues) haptic("tap");
  }, [cues, haptics, medPhase, medRun]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const toggleSession = async () => {
    const audio = audioRef.current;
    haptic("tap");
    if (medRun) {
      audio?.pause();
      pause();
      return;
    }
    start();
    if (audio && soundEnabled) await audio.play().catch(() => undefined);
  };

  const resetSession = () => {
    const audio = audioRef.current;
    haptic("tap");
    restart();
    if (audio) audio.currentTime = 0;
  };

  const selectTrack = (index: number, autoPlay = medRun) => {
    const nextIndex = (index + TRACKS.length) % TRACKS.length;
    haptic("tap");
    setTrackIndex(nextIndex);
    requestAnimationFrame(() => {
      const audio = audioRef.current;
      if (audio && autoPlay && soundEnabled) void audio.play().catch(() => undefined);
    });
  };

  return (
    <section className="zen-console zen-flow" aria-label="Zen Flow Chamber">
      <header className="zen-flow__header">
        <strong className="zen-flow__brand"><i />AXEN</strong>
        <span>ZEN // FLOW CHAMBER</span>
        <div className="zen-flow__coins"><Coins /> {coins ?? 91} coins</div>
      </header>
      <div className="zen-flow__tabs" role="tablist" aria-label="Zen modes">
        <Button variant="ghost" role="tab" aria-selected="true">BREATH</Button>
        <Button variant="ghost" role="tab" aria-selected="false" onClick={() => setSoundSheet(true)}>SOUND</Button>
        <Button variant="ghost" role="tab" aria-selected="false" onClick={() => setSettingsSheet(true)}>BODY</Button>
      </div>
      <div className="zen-flow__duration">
        <span>{fmtT(medMin * 60)}</span>
        <Button variant="ghost" size="icon" aria-label="Open Zen settings" onClick={() => setSettingsSheet(true)}><Settings /></Button>
      </div>

      <div className="zen-chamber" data-phase={medPhase}>
        <NeuralWaveCanvas running={medRun} elapsed={getElapsedMs} phase={medPhase} phaseProgress={phaseProgress} intensity={intensity / 100} preset={preset} />
        <motion.div className="zen-breath-core" animate={{ scale: breathScale }} transition={{ duration: medRun ? 0.08 : 0.35, ease: "linear" }}>
          <i className="zen-breath-core__pearl" />
          <span>{medStatus === "complete" ? "SESSION COMPLETE" : medStatus === "idle" ? "READY" : phaseLabel}</span>
          <strong>{medStatus === "idle" ? String(medMin).padStart(2, "0") : medStatus === "complete" ? "✓" : String(phaseCountdown).padStart(2, "0")}</strong>
          <small>{medStatus === "idle" ? "Tap play to begin" : medStatus === "complete" ? "Flow recorded" : phaseInstruction}</small>
          <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="1" style={{ strokeDashoffset: 1 - sessionProgress }} /></svg>
        </motion.div>
      </div>

      <div className="zen-flow__timeline" aria-label="Breathing timeline">
        <div className="zen-flow__timeline-track"><motion.i animate={{ left: `${((phaseIndex + phaseProgress) / 4) * 100}%` }} transition={{ duration: 0.08, ease: "linear" }} /></div>
        {PHASES.map((item, index) => <div key={item.key} data-active={phaseIndex === index}><i><Waves /></i><span>{item.label}</span><strong>4</strong></div>)}
      </div>

      <div className="zen-flow__quote">
        <h2>{quote}</h2>
        <p>Session {fmtT(Math.floor(elapsedMs / 1000))} / {fmtT(medMin * 60)} <b>•</b> Box Breathing</p>
      </div>

      <div className="zen-flow__controls">
        <Button variant="ghost" className="zen-flow__side-control" aria-pressed={haptics} onClick={() => setHaptics(value => !value)}><HeartPulse /><span>HAPTIC</span></Button>
        <Button className="zen-flow__main-control" onClick={toggleSession} disabled={medStatus === "complete"} aria-label={medRun ? "Pause meditation" : medStatus === "paused" ? "Resume meditation" : "Start meditation"}>
          {medRun ? <Pause /> : <Play />}<span>{medRun ? "PAUSE" : medStatus === "paused" ? "RESUME" : "START"}</span>
        </Button>
        <Button variant="ghost" className="zen-flow__side-control" aria-pressed={soundEnabled} onClick={() => setSoundSheet(true)}><Volume2 /><span>SOUND</span></Button>
      </div>

      <Sheet open={soundSheet} onOpenChange={setSoundSheet}>
        <SheetContent side="bottom" className="zen-sheet">
          <SheetHeader><SheetTitle>Sound chamber</SheetTitle><SheetDescription>Choose an existing AXEN soundscape.</SheetDescription></SheetHeader>
          <div className="zen-sheet__toggle"><span>Sound</span><Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} aria-label="Sound enabled" /></div>
          <div className="zen-sheet__volume"><Volume2 /><Slider value={[volume]} max={100} onValueChange={value => setVolume(value[0] ?? 68)} aria-label="Soundscape volume" /><span>{volume}%</span></div>
          <div className="zen-sheet__list">{TRACKS.map((item, index) => <Button key={item.id} variant="ghost" aria-pressed={trackIndex === index} onClick={() => selectTrack(index)}><span><strong>{item.title}</strong><small>{item.subtitle}</small></span>{trackIndex === index && <i />}</Button>)}</div>
        </SheetContent>
      </Sheet>
      <Sheet open={settingsSheet} onOpenChange={setSettingsSheet}>
        <SheetContent side="bottom" className="zen-sheet">
          <SheetHeader><SheetTitle>Flow settings</SheetTitle><SheetDescription>Breathe gently and stop if you feel uncomfortable or light-headed.</SheetDescription></SheetHeader>
          <h3>Session duration</h3>
          <div className="zen-sheet__durations">{[5,10,15,20].map(minutes => <Button key={minutes} variant="ghost" disabled={medRun} aria-pressed={medMin === minutes} onClick={() => pickMed(minutes)}>{minutes}<small>MIN</small></Button>)}</div>
          <h3>Visual wave preset</h3>
          <div className="zen-sheet__presets">{PRESETS.map(item => <Button key={item.key} variant="ghost" aria-pressed={preset === item.key} onClick={() => setPreset(item.key)}><Gauge />{item.label}</Button>)}</div>
          <h3>Field intensity</h3>
          <div className="zen-sheet__volume"><Waves /><Slider value={[intensity]} min={20} max={100} step={1} onValueChange={value => setIntensity(value[0] ?? 68)} aria-label="Field intensity" /><span>{intensity}%</span></div>
          <div className="zen-sheet__toggle"><span>Eyes closed cues</span><Switch checked={cues} onCheckedChange={setCues} aria-label="Eyes closed cues" /></div>
          <div className="zen-flow__ledger"><span><b>Today</b> {medTotal} min</span><span><b>{medSessions}</b> sessions</span><span><b>+{medMin * 2}</b> XP</span></div>
          <Button variant="outline" className="zen-sheet__restart" onClick={() => { resetSession(); setSettingsSheet(false); }}><RotateCcw /> Restart session</Button>
        </SheetContent>
      </Sheet>

      <AnimatePresence>{medStatus === "complete" && <motion.div className="zen-complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>SESSION COMPLETE</motion.div>}</AnimatePresence>

      <audio ref={audioRef} src={track.src} loop preload="metadata" />
    </section>
  );
}
