import { useId } from "react";
import type { MilestoneSealTier } from "@/lib/milestone-seals";

// Alternating points create a crisp scalloped metallic rim without bitmap media.
const sealPath = Array.from({ length: 52 }, (_, i) => {
  const a = i * Math.PI / 26 - Math.PI / 2;
  const r = i % 2 === 0 ? 23 : 19.4;
  return `${i ? "L" : "M"}${24 + Math.cos(a) * r},${24 + Math.sin(a) * r}`;
}).join(" ") + " Z";

export function MilestoneSeal({ tier, label, shine = false, className = "" }: { tier: MilestoneSealTier; label: string; shine?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const ref = (name: string) => `url(#${id}-${name})`;
  return <span className={`milestone-seal milestone-seal--${tier} ${className}`} role="img" aria-label={label}>
    <svg viewBox="-6 -6 60 60" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--seal-highlight)" /><stop offset="50%" stopColor="var(--seal-tier)" /><stop offset="100%" stopColor="var(--seal-shadow)" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--seal-rim)" /><stop offset="100%" stopColor="var(--seal-shadow)" /></linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--seal-white)" stopOpacity=".6" /><stop offset="60%" stopColor="var(--seal-white)" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}-check`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--seal-white)" /><stop offset="100%" stopColor="var(--seal-check-end)" /></linearGradient>
        <linearGradient id={`${id}-sweep`}><stop stopColor="var(--seal-white)" stopOpacity="0" /><stop offset="50%" stopColor="var(--seal-white)" stopOpacity=".8" /><stop offset="100%" stopColor="var(--seal-white)" stopOpacity="0" /></linearGradient>
        <filter id={`${id}-check-shadow`} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy=".8" stdDeviation=".5" floodColor="var(--seal-black)" floodOpacity=".55" /></filter>
        <clipPath id={`${id}-clip`}><path d={sealPath} /></clipPath>
      </defs>
      <circle cx="24" cy="24" r="26.5" fill="none" stroke="var(--seal-tier)" strokeWidth={tier === "diamond" ? 1.5 : 1} strokeDasharray="4 3" opacity={tier === "diamond" ? 1 : .55} />
      <path d={sealPath} fill={ref("body")} stroke="var(--seal-tier)" strokeWidth="1.2" strokeLinejoin="round" />
      <path d={sealPath} fill={ref("gloss")} />
      <circle cx="24" cy="24" r="16.5" fill="none" stroke="var(--seal-white)" strokeOpacity=".35" strokeWidth=".8" />
      <path d="M12.5 25.2 C16 25.5 19.5 28 21.2 31.2 C25 26 30 20 36.5 14.5 C32 22.5 28 29 24 36.2 C23.2 37.5 21.6 37.4 20.8 36.2 C18.5 32 15.5 28.2 12.5 25.2 Z" transform="translate(-0.5,-2)" fill="var(--seal-check)" />
      {tier === "diamond" && <g fill="var(--seal-highlight)"><path d="m49 -5 1.1 3.2L53 -1l-2.9.9L49 3l-1-3.1L45 -1l3-.8Z" /><path d="m-1 45 .9 2.6L3 49l-3.1.9L-1 53l-.9-3.1L-5 49l3.1-1.4Z" /></g>}
      {shine && <g clipPath={ref("clip")}><g className="milestone-seal__sweep"><path d="M-15-20H-3L42 68H30Z" fill={ref("sweep")} /></g></g>}
    </svg>
  </span>;
}