import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Infinity as InfinityIcon,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { haptic } from "@/lib/haptics";
import manifestation from "@/assets/audio/deep-manifestation.mp3.asset.json";
import stillness852 from "@/assets/audio/852hz-stillness.mp3.asset.json";
import higherSelf from "@/assets/audio/higher-self-alpha.mp3.asset.json";
import spiritual10 from "@/assets/audio/spiritual-guide-10.mp3.asset.json";
import spiritual15 from "@/assets/audio/spiritual-guide-15.mp3.asset.json";
import thetaWaves from "@/assets/audio/theta-waves.mp3.asset.json";
import tibetanBowls from "@/assets/audio/tibetan-bowls.mp3.asset.json";

const TRACKS = [
  { id: "manifestation", title: "Deep Manifestation", subtitle: "Align energy & intentions", frequency: "Theta flow", src: manifestation.url },
  { id: "stillness-852", title: "852 Hz Stillness", subtitle: "Release thought loops", frequency: "852 Hz", src: stillness852.url },
  { id: "higher-self", title: "Higher Self", subtitle: "Alpha wave meditation", frequency: "Alpha flow", src: higherSelf.url },
  { id: "spiritual-10", title: "Spiritual Guide", subtitle: "Super deep healing", frequency: "Deep healing", src: spiritual10.url },
  { id: "spiritual-15", title: "Spiritual Guide II", subtitle: "Extended deep healing", frequency: "Deep healing", src: spiritual15.url },
  { id: "theta-waves", title: "Relaxing Theta Waves", subtitle: "Slow down your brainwaves", frequency: "Theta binaural", src: thetaWaves.url },
  { id: "tibetan-bowls", title: "Tibetan Singing Bowls", subtitle: "Release fatigue & tension", frequency: "Healing bowls", src: tibetanBowls.url },
] as const;

const WAVE_BARS = [12, 25, 18, 36, 28, 48, 34, 56, 42, 68, 52, 76, 61, 82, 56, 72, 44, 64, 38, 54, 31, 46, 26, 38, 20, 31, 16, 24];

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function ZenTab({ med }: {
  med: {
    medMin: number; medLeft: number; medRun: boolean;
    setMedRun: React.Dispatch<React.SetStateAction<boolean>>;
    medSessions: number; medTotal: number;
    medPhase: "inhale" | "hold" | "exhale" | "hold2";
    medPhaseLabel: string;
    pickMed: (m: number) => void;
    fmtT: (s: number) => string;
  };
}) {
  const { medMin, medLeft, medRun, setMedRun, medSessions, medTotal, medPhaseLabel, pickMed, fmtT } = med;
  const [trackIndex, setTrackIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState(72);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const track = TRACKS[trackIndex];
  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  const ringRadius = 88;
  const ringLength = 2 * Math.PI * ringRadius;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    if (medRun) return;
    audioRef.current?.pause();
  }, [medRun]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    haptic("tap");
    if (medRun) {
      audio.pause();
      setMedRun(false);
      return;
    }
    try {
      await audio.play();
      setMedRun(true);
    } catch {
      setMedRun(false);
    }
  };

  const resetSession = () => {
    const audio = audioRef.current;
    haptic("tap");
    setMedRun(false);
    pickMed(medMin);
    if (audio) audio.currentTime = 0;
    setElapsed(0);
  };

  const selectTrack = (index: number, autoPlay = medRun) => {
    const nextIndex = (index + TRACKS.length) % TRACKS.length;
    haptic("tap");
    setTrackIndex(nextIndex);
    setElapsed(0);
    setDuration(0);
    requestAnimationFrame(() => {
      const audio = audioRef.current;
      if (audio && autoPlay) void audio.play().catch(() => setMedRun(false));
    });
  };

  const seek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const next = (value[0] / 100) * duration;
    audio.currentTime = next;
    setElapsed(next);
  };

  return (
    <section className="zen-console" aria-label="Zen Mode meditation player">
      <div className="zen-console__aura" aria-hidden="true" />
      <header className="zen-console__header">
        <div>
          <span className="zen-console__eyebrow"><Sparkles size={12} /> Neural stillness protocol</span>
          <h1>ZEN MODE</h1>
        </div>
        <div className="zen-console__live"><i /> {medRun ? "ACTIVE" : "READY"}</div>
      </header>

      <div className="zen-session-pills" aria-label="Session length">
        {[5, 10, 15, 20].map((minutes) => (
          <Button
            key={minutes}
            type="button"
            variant="ghost"
            disabled={medRun}
            aria-pressed={medMin === minutes}
            className="zen-session-pill"
            onClick={() => { haptic("tap"); pickMed(minutes); }}
          >
            {minutes}<small>MIN</small>
          </Button>
        ))}
      </div>

      <div className="zen-player">
        <div className="zen-player__grid" aria-hidden="true" />
        <div className="zen-wave" aria-hidden="true">
          {WAVE_BARS.map((height, index) => (
            <i key={`${height}-${index}`} style={{ "--zen-wave-height": `${height}%`, "--zen-wave-delay": `${index * -38}ms` } as React.CSSProperties} />
          ))}
        </div>

        <div className="zen-ring-wrap">
          <svg className="zen-ring" viewBox="0 0 200 200" aria-hidden="true">
            <circle className="zen-ring__track" cx="100" cy="100" r={ringRadius} />
            <circle
              className="zen-ring__progress"
              cx="100"
              cy="100"
              r={ringRadius}
              strokeDasharray={ringLength}
              strokeDashoffset={ringLength * (1 - progress)}
            />
          </svg>
          <div className={`zen-ring__core${medRun ? " zen-ring__core--active" : ""}`}>
            <span>{medRun ? medPhaseLabel : "SESSION"}</span>
            <strong>{fmtT(medLeft)}</strong>
            <small>{medRun ? "BREATHE WITH THE PULSE" : `${medMin} MIN PROTOCOL`}</small>
          </div>
        </div>

        <div className="zen-track-copy">
          <span>{track.frequency}</span>
          <h2>{track.title}</h2>
          <p>{track.subtitle}</p>
        </div>

        <div className="zen-seek">
          <Slider value={[progress * 100]} max={100} step={0.1} onValueChange={seek} aria-label="Track position" />
          <div><span>{formatAudioTime(elapsed)}</span><span>{formatAudioTime(duration)}</span></div>
        </div>

        <div className="zen-controls">
          <Button type="button" variant="ghost" size="icon" className="zen-icon-button" onClick={() => selectTrack(trackIndex - 1)} aria-label="Previous meditation track">
            <ChevronLeft />
          </Button>
          <Button type="button" size="icon" className="zen-play-button" onClick={togglePlayback} aria-label={medRun ? "Pause meditation" : "Play meditation"}>
            {medRun ? <Pause /> : <Play className="zen-play-icon" />}
          </Button>
          <Button type="button" variant="ghost" size="icon" className="zen-icon-button" onClick={() => selectTrack(trackIndex + 1)} aria-label="Next meditation track">
            <ChevronRight />
          </Button>
        </div>

        <div className="zen-utility-row">
          <div className="zen-volume">
            <Volume2 size={16} />
            <Slider value={[volume]} max={100} step={1} onValueChange={(value) => setVolume(value[0])} aria-label="Volume" />
            <span>{volume}%</span>
          </div>
          <span className="zen-loop-button" aria-label="Looping until session ends" title="Loops until the session timer ends">
            <InfinityIcon />
          </span>
          <Button type="button" variant="ghost" size="icon-sm" className="zen-loop-button" onClick={resetSession} aria-label="Reset session">
            <RotateCcw />
          </Button>
        </div>
      </div>

      <div className="zen-library" aria-label="Meditation library">
        {TRACKS.map((item, index) => (
          <Button key={item.id} type="button" variant="ghost" className="zen-library__track" aria-pressed={trackIndex === index} onClick={() => selectTrack(index)}>
            <span className="zen-library__number">0{index + 1}</span>
            <span className="zen-library__copy"><strong>{item.title}</strong><small>{item.frequency}</small></span>
            <span className="zen-library__state">{trackIndex === index ? <Check /> : <Play />}</span>
          </Button>
        ))}
      </div>

      <div className="zen-ledger">
        <div><strong>{medSessions}</strong><span>Sessions</span></div>
        <div><strong>{medTotal}m</strong><span>Today</span></div>
        <div><strong>+{medMin * 2}</strong><span>Next reward</span></div>
      </div>

      <audio
        ref={audioRef}
        src={track.src}
        loop
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
        onEnded={(event) => {
          const audio = event.currentTarget;
          audio.currentTime = 0;
          if (medRun) void audio.play().catch(() => undefined);
        }}
      />
    </section>
  );
}
