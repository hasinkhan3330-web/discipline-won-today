import { useEffect, useRef } from "react";
import type { VoicePhase } from "@/components/VoiceCoach";
import s from "./coach-orb.module.css";

const hex = (h: string) => [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];

/** 1:1 port of the reference orb. Levels come from live analysers via getLevel. */
export function OrbCanvas({ colors, getMode, getLevel, onMode }: { colors: [string, string]; getMode: () => VoicePhase; getLevel: () => number; onMode: (m: VoicePhase) => void }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const live = useRef({ getMode, getLevel, onMode, cA: hex(colors[0]), cB: hex(colors[1]) });
  live.current.getMode = getMode; live.current.getLevel = getLevel; live.current.onMode = onMode;
  live.current.cA = hex(colors[0]); live.current.cB = hex(colors[1]);

  useEffect(() => {
    const cv = cvRef.current!, glow = glowRef.current!, ctx = cv.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const N = 450, ga = Math.PI * (3 - Math.sqrt(5));
    const pts: Array<{ x: number; y: number; z: number; sz: number; teal: boolean; m: number; ph: number; sp: number }> = [];
    for (let i = 0; i < N; i++) { const y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), th = ga * i;
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, sz: .6 + Math.random() * 1.5, teal: Math.random() < .15, m: .4 + Math.random() * 1.1, ph: Math.random() * 6.28, sp: .5 + Math.random() * 2 }); }
    let W = 300, H = 300; const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => { const rc = cv.getBoundingClientRect(); W = rc.width || 300; H = rc.height || 300; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); window.addEventListener("resize", size);
    let scatter = 0, spin = 0, expand = 1, level = 0, ang = 0, raf = 0, prevMode: VoicePhase | null = null;
    const t0 = performance.now(); let last = t0;
    const frame = (now: number) => {
      const t = (now - t0) / 1000, dt = Math.min((now - last) / 1000, .05); last = now;
      const mode = live.current.getMode();
      if (mode !== prevMode) { prevMode = mode; live.current.onMode(mode); }
      let tgtScatter = 0, tgtSpin = .15, tgtExp = 1;
      const real = Math.max(0, Math.min(1, live.current.getLevel()));
      if (mode === "listen") { level = real; tgtScatter = .05 + .09 * level; tgtSpin = .28; tgtExp = 1.02; }
      else if (mode === "speak") { level = real; tgtScatter = .03 + .05 * level; tgtSpin = .25; tgtExp = 1 + .02 * level; }
      else if (mode === "think") { level = .3; tgtScatter = .02; tgtSpin = .4; tgtExp = 1; }
      else { level = 0; }
      const k = 1 - Math.pow(.0015, dt);
      scatter += (tgtScatter - scatter) * k; spin += (tgtSpin - spin) * k; expand += (tgtExp - expand) * k;
      if (reduce) spin *= .3;
      ang += spin * dt;
      const breathe = 1 + .06 * Math.sin(t * 1.57);
      glow.style.transform = "scale(" + (breathe * expand * (1 + scatter * .25)).toFixed(3) + ")";
      glow.style.opacity = (.75 + .25 * level + scatter * .3).toFixed(2);
      ctx.clearRect(0, 0, W, H);
      const { cA, cB } = live.current;
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * .40 * expand, ca = Math.cos(ang), sa = Math.sin(ang), ct = Math.cos(.35), st = Math.sin(.35);
      for (let i = 0; i < N; i++) { const p = pts[i]!;
        let f = 1 + scatter * p.m * Math.sin(t * p.sp * 1.6 + p.ph); if (f > 1.1) f = 1.1;
        const x = p.x * f, y = p.y * f, z = p.z * f;
        const x1 = x * ca + z * sa, z1 = -x * sa + z * ca, y1 = y * ct - z1 * st, z2 = y * st + z1 * ct;
        const d = (z2 + 1.5) / 3, px = cx + x1 * R, py = cy + y1 * R;
        const c = p.teal ? cB : cA, al = Math.max(.12, Math.min(1, .2 + .85 * d));
        ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + al.toFixed(2) + ")";
        ctx.beginPath(); ctx.arc(px, py, p.sz * (.55 + .9 * d) * (1 + scatter * .3), 0, 6.283); ctx.fill(); }
      raf = requestAnimationFrame(frame);
    };
    const run = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); };
    const vis = () => { if (document.hidden) cancelAnimationFrame(raf); else run(); };
    document.addEventListener("visibilitychange", vis);
    run();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", size); document.removeEventListener("visibilitychange", vis); };
  }, []);

  return <div className={s.stage}><div className={s.glow} ref={glowRef} /><canvas className={s.cv} ref={cvRef} aria-hidden="true" /></div>;
}
