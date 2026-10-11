import { useEffect, useMemo, useRef, useState } from "react";
import {
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
import { type BreathPhase, type WavePreset } from "@/components/NeuralWaveCanvas";
import { haptic } from "@/lib/haptics";
import { EclipseHero } from "@/components/zen/EclipseHero";
import { SessionCard } from "@/components/zen/SessionCard";
import zen from "@/components/zen/eclipse.module.css";
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
  const { medMin, medLeft, medRun, medStatus, medSessions, medTotal, elapsedMs, medPhase, phaseProgress, phaseCountdown, start, pause, restart, pickMed, fmtT } = med;
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
  const breathScale = medPhase === "inhale" ? 1 + phaseProgress * 0.08 : medPhase === "holdFull" ? 1.08 : medPhase === "exhale" ? 1.08 - phaseProgress * 0.08 : 1;
  const [pageHidden, setPageHidden] = useState(false);
  useEffect(() => {
    const update = () => setPageHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
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
    <section className={`${zen.scope} ${zen.page}`} data-hidden={pageHidden} aria-label="Zen Flow Chamber">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700&family=JetBrains+Mono:wght@500&display=swap" />
      <header className={zen.header}>
        <div className={zen.brand}><strong>AXEN</strong><p>DISCIPLINE BUILDS FREEDOM</p></div>
        <div className={zen.coins}><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/></svg>{coins ?? 0} coins</div>
      </header>
      {medStatus === "idle" ? <>
        <EclipseHero />
        <div className={zen.selection}>
          <div className={zen.label}>SELECT YOUR SESSION</div>
          <div className={zen.sessions}>{[{minutes:5,caption:"Quick Reset"},{minutes:10,caption:"Deep Calm"},{minutes:15,caption:"Inner Peace"},{minutes:20,caption:"Extended"}].map(item => <SessionCard key={item.minutes} {...item} selected={medMin === item.minutes} disabled={medRun} onSelect={() => pickMed(item.minutes)} />)}</div>
          <div className={zen.options}>
            <Button variant="ghost" className={zen.option} onClick={() => setSoundSheet(true)} aria-label="Open Sound chamber"><svg viewBox="0 0 26 22" fill="none" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M5 8v6M9 4v14M13 7v8M17 5v12M21 9v4"/></svg><span><strong>Sound</strong><small>{track.title}</small></span></Button>
            <Button variant="ghost" className={zen.option} onClick={() => setSettingsSheet(true)} aria-label="Open Flow settings"><svg viewBox="0 0 22 22" fill="none" strokeWidth="1.6" aria-hidden="true"><circle cx="11" cy="11" r="7"/><circle cx="11" cy="11" r="4" fillOpacity=".25"/></svg><span><strong>Corona</strong><small>{PRESETS.find(item => item.key === preset)?.label}</small></span></Button>
          </div>
          <Button className={zen.start} onClick={toggleSession}><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6 3l11 7-11 7z"/></svg>START SESSION</Button>
          <p className={zen.footer}>Close your eyes · Feel the energy · Be the best version of you</p>
        </div>
      </> : <>
        <EclipseHero session scale={breathScale} progress={sessionProgress} preset={preset} intensity={intensity / 100}>
          <div className={zen.sessionCenter}><span>{medStatus === "complete" ? "SESSION COMPLETE" : phaseLabel}</span><strong>{medStatus === "complete" ? "✓" : fmtT(medLeft)}</strong><small>{medStatus === "complete" ? "Flow recorded" : phaseInstruction}</small></div>
        </EclipseHero>
        <div className={zen.chamberContent}>
          <div className={zen.phases} aria-label="Breathing timeline">{PHASES.map((item,index) => <div key={item.key} data-active={phaseIndex === index}><span>{item.label}</span><strong>{phaseIndex === index ? phaseCountdown : 4}s</strong></div>)}</div>
          <div className={zen.tabs} role="tablist" aria-label="Zen modes">
            <Button variant="ghost" role="tab" aria-selected="true">BREATH</Button>
            <Button variant="ghost" role="tab" aria-selected="false" onClick={() => setSoundSheet(true)}>SOUND</Button>
            <Button variant="ghost" role="tab" aria-selected="false" onClick={() => setSettingsSheet(true)}>BODY</Button>
          </div>
          <div className={zen.quote}><h2>{quote}</h2><p>Session {fmtT(Math.floor(elapsedMs / 1000))} / {fmtT(medMin * 60)} <b>•</b> Box Breathing</p></div>
          <div className={zen.controls}>
            <Button variant="ghost" className={zen.control} aria-pressed={haptics} onClick={() => setHaptics(value => !value)}><HeartPulse /><span>HAPTIC</span></Button>
            <Button className={zen.start} onClick={toggleSession} disabled={medStatus === "complete"} aria-label={medRun ? "Pause meditation" : medStatus === "paused" ? "Resume meditation" : "Start meditation"}>{medRun ? <Pause /> : <Play />}<span>{medRun ? "PAUSE" : medStatus === "paused" ? "RESUME" : "START"}</span></Button>
            <Button variant="ghost" className={zen.control} aria-pressed={soundEnabled} onClick={() => setSoundSheet(true)}><Volume2 /><span>SOUND</span></Button>
          </div>
          <Button variant="ghost" className={zen.control} aria-label="Open Zen settings" onClick={() => setSettingsSheet(true)}><Settings /></Button>
        </div>
      </>}

      <Sheet open={soundSheet} onOpenChange={setSoundSheet}>
        <SheetContent side="bottom" className={`${zen.scope} ${zen.sheet}`} data-hidden={pageHidden}>
          <SheetHeader><SheetTitle className={zen.sheetTitle}>Sound chamber</SheetTitle><SheetDescription className={zen.sheetDescription}>Choose an existing AXEN soundscape.</SheetDescription></SheetHeader>
          <div className="zen-sheet__toggle"><span>Sound</span><Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} aria-label="Sound enabled" /></div>
          <div className="zen-sheet__volume"><Volume2 /><Slider value={[volume]} max={100} onValueChange={value => setVolume(value[0] ?? 68)} aria-label="Soundscape volume" /><span>{volume}%</span></div>
          <div className="zen-sheet__list">{TRACKS.map((item, index) => <Button key={item.id} variant="ghost" aria-pressed={trackIndex === index} onClick={() => selectTrack(index)}><span><strong>{item.title}</strong><small>{item.subtitle}</small></span>{trackIndex === index && <i />}</Button>)}</div>
        </SheetContent>
      </Sheet>
      <Sheet open={settingsSheet} onOpenChange={setSettingsSheet}>
        <SheetContent side="bottom" className={`${zen.scope} ${zen.sheet}`} data-hidden={pageHidden}>
          <SheetHeader><SheetTitle className={zen.sheetTitle}>Flow settings</SheetTitle><SheetDescription className={zen.sheetDescription}>Breathe gently and stop if you feel uncomfortable or light-headed.</SheetDescription></SheetHeader>
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

      <AnimatePresence>{medStatus === "complete" && <motion.div className={zen.complete} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>SESSION COMPLETE</motion.div>}</AnimatePresence>

      <audio ref={audioRef} src={track.src} loop preload="metadata" />
    </section>
  );
}
