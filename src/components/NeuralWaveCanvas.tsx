import { useEffect, useRef } from "react";

export type WavePreset = "theta" | "alpha" | "beta" | "gamma";
export type BreathPhase = "inhale" | "holdFull" | "exhale" | "holdEmpty";

const PRESETS: Record<WavePreset, { speed: number; density: number; amplitude: number; violet: number }> = {
  theta: { speed: 0.55, density: 74, amplitude: 0.86, violet: 0.42 },
  alpha: { speed: 0.72, density: 84, amplitude: 1, violet: 0.5 },
  beta: { speed: 0.96, density: 94, amplitude: 1.08, violet: 0.43 },
  gamma: { speed: 1.18, density: 108, amplitude: 1.14, violet: 0.6 },
};

function seeded(index: number) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function phaseEnergy(phase: BreathPhase, progress: number) {
  if (phase === "inhale") return 0.76 + 0.24 * (0.5 - Math.cos(progress * Math.PI) / 2);
  if (phase === "holdFull") return 1;
  if (phase === "exhale") return 1 - 0.24 * (0.5 - Math.cos(progress * Math.PI) / 2);
  return 0.76;
}

export function NeuralWaveCanvas({
  running,
  elapsed,
  phase,
  phaseProgress,
  intensity,
  preset,
}: {
  running: boolean;
  elapsed: () => number;
  phase: BreathPhase;
  phaseProgress: number;
  intensity: number;
  preset: WavePreset;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const propsRef = useRef({ running, elapsed, phase, phaseProgress, intensity, preset });
  propsRef.current = { running, elapsed, phase, phaseProgress, intensity, preset };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = () => {
      const { running: isRunning, elapsed: getElapsed, phase: currentPhase, phaseProgress: currentProgress, intensity: level, preset: currentPreset } = propsRef.current;
      const config = PRESETS[currentPreset];
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const cx = width / 2;
      const cy = height * 0.48;
      const logicalTime = getElapsed() / 1000;
      const time = reduced ? 0 : logicalTime * config.speed;
      const energy = phaseEnergy(currentPhase, currentProgress);
      const amplitude = config.amplitude * (0.58 + level * 0.72) * energy;

      context.clearRect(0, 0, width, height);
      const backdrop = context.createRadialGradient(cx, cy, 8, cx, cy, Math.max(width, height) * 0.62);
      backdrop.addColorStop(0, "rgba(36,123,255,0.19)");
      backdrop.addColorStop(0.42, "rgba(5,27,67,0.10)");
      backdrop.addColorStop(1, "rgba(2,7,18,0)");
      context.fillStyle = backdrop;
      context.fillRect(0, 0, width, height);

      const lineCount = reduced ? 54 : config.density;
      context.globalCompositeOperation = "lighter";
      for (let i = 0; i < lineCount; i += 1) {
        const depth = i / Math.max(1, lineCount - 1);
        const seed = seeded(i + 4);
        const side = i % 2 === 0 ? -1 : 1;
        const spread = (depth - 0.5) * height * 0.84;
        const phaseOffset = seed * Math.PI * 2;
        const colorBias = side < 0 ? 0 : config.violet;
        const hue = 188 + depth * 40 + colorBias * 44;
        context.beginPath();
        for (let step = 0; step <= 52; step += 1) {
          const u = step / 52;
          const x = u * width;
          const distance = Math.abs(x - cx) / Math.max(1, cx);
          const chamberLift = Math.exp(-Math.pow((x - cx) / (width * 0.24), 2));
          const direction = x < cx ? -1 : 1;
          const flow = Math.sin(u * 7.2 + time * 0.78 + phaseOffset) * 9;
          const ripple = Math.sin(u * 17 + time * 1.15 + i * 0.19) * 2.6;
          const channel = spread * (0.34 + distance * 0.92);
          const curl = direction * chamberLift * (28 + Math.abs(spread) * 0.24) * Math.sin(u * Math.PI * 1.8 + phaseOffset * 0.15);
          const y = cy + channel + (flow + ripple) * amplitude + curl * amplitude;
          if (step === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = `hsla(${hue}, 98%, ${58 + seed * 18}%, ${0.075 + (1 - Math.abs(depth - 0.5) * 1.5) * 0.23})`;
        context.lineWidth = 0.45 + seed * 0.85;
        context.shadowColor = `hsla(${hue}, 100%, 62%, 0.5)`;
        context.shadowBlur = level * 4.5;
        context.stroke();
      }

      const particleCount = reduced ? 10 : Math.round(18 + level * 34);
      context.shadowBlur = 7 + level * 5;
      for (let i = 0; i < particleCount; i += 1) {
        const seed = seeded(i + 201);
        const speed = 0.015 + seeded(i + 301) * 0.022;
        const u = reduced ? seed : (seed + time * speed) % 1;
        const x = u * width;
        const side = x < cx ? -1 : 1;
        const distance = Math.abs(x - cx) / Math.max(1, cx);
        const band = (seeded(i + 401) - 0.5) * height * 0.68 * (0.34 + distance);
        const y = cy + band + Math.sin(u * 10 + i) * 8 * amplitude;
        const violet = side > 0;
        context.fillStyle = violet ? "rgba(130,87,255,0.72)" : "rgba(32,231,242,0.76)";
        context.shadowColor = violet ? "#8257ff" : "#20e7f2";
        context.beginPath();
        context.arc(x, y, 0.65 + seeded(i + 501) * 1.15, 0, Math.PI * 2);
        context.fill();
      }

      context.shadowBlur = 12;
      context.strokeStyle = "rgba(91,151,255,0.72)";
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(cx, cy, width * 0.245, width * 0.125, -0.32, 0.22, Math.PI * 1.62);
      context.stroke();
      const orbit = reduced ? 0.68 : logicalTime * 0.42;
      const ox = cx + Math.cos(orbit) * width * 0.23;
      const oy = cy + Math.sin(orbit) * width * 0.115;
      context.fillStyle = "#20e7f2";
      context.shadowColor = "#20e7f2";
      context.shadowBlur = 15;
      context.beginPath();
      context.arc(ox, oy, 3.1, 0, Math.PI * 2);
      context.fill();
      context.globalCompositeOperation = "source-over";

      if (isRunning && !reduced) frameRef.current = requestAnimationFrame(draw);
    };

    resize();
    draw();
    const observer = new ResizeObserver(() => { resize(); draw(); });
    observer.observe(canvas);
    window.addEventListener("resize", resize);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [running, elapsed, phase, phaseProgress, intensity, preset]);

  return <canvas ref={canvasRef} className="zen-flow-canvas" aria-hidden="true" />;
}