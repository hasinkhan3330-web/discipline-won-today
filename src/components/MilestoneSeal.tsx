import { useId } from "react";
import type { MilestoneSealTier } from "@/lib/milestone-seals";

// Alternating points create a crisp scalloped metallic rim without bitmap media.
const sealPath = Array.from({ length: 64 }, (_, i) => {
  const a = i * Math.PI / 32 - Math.PI / 2;
  const r = i % 2 === 0 ? 21 : 19.1;
  return `${i ? "L" : "M"}${24 + Math.cos(a) * r},${24 + Math.sin(a) * r}`;
}).join(" ") + " Z";

export function MilestoneSeal({ tier, label, shine = false, className = "" }: { tier: MilestoneSealTier; label: string; shine?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const ref = (name: string) => `url(#${id}-${name})`;
  return <span className={`milestone-seal milestone-seal--${tier} ${className}`} role="img" aria-label={label}>
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--seal-highlight)" /><stop offset="40%" stopColor="var(--seal-tier)" /><stop offset="72%" stopColor="var(--seal-shadow)" /><stop offset="100%" stopColor="var(--seal-tier)" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--seal-rim)" /><stop offset="100%" stopColor="var(--seal-shadow)" /></linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--seal-white)" stopOpacity=".6" /><stop offset="50%" stopColor="var(--seal-white)" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}-check`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--seal-white)" /><stop offset="100%" stopColor="var(--seal-check-end)" /></linearGradient>
        <linearGradient id={`${id}-sweep`}><stop stopColor="var(--seal-white)" stopOpacity="0" /><stop offset="50%" stopColor="var(--seal-white)" stopOpacity=".8" /><stop offset="100%" stopColor="var(--seal-white)" stopOpacity="0" /></linearGradient>
        <filter id={`${id}-check-shadow`} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy=".8" stdDeviation=".5" floodColor="var(--seal-black)" floodOpacity=".55" /></filter>
        <clipPath id={`${id}-clip`}><path d={sealPath} /></clipPath>
      </defs>
      <path d={sealPath} fill={ref("body")} stroke={ref("rim")} strokeWidth="1.4" />
      <path d={sealPath} fill={ref("gloss")} />
      <circle cx="24" cy="24" r="16.5" fill="none" stroke="var(--seal-black)" strokeOpacity=".35" />
      <circle cx="24" cy="24" r="15.5" fill="none" stroke="var(--seal-white)" strokeOpacity=".35" />
      <path d="M12.5 24.1 17 21.4 22 28.3 35.8 13.3 24.2 34.5 20.7 34.5Z" fill={ref("check")} filter={ref("check-shadow")} />
      {tier === "diamond" && <g fill="var(--seal-rim)"><circle cx="24" cy="24" r="23" fill="none" stroke="var(--seal-rim)" strokeWidth=".8" strokeDasharray="3 2.5" opacity=".8" /><path d="m44 0 1.1 3.2L48 4l-2.9.9L44 8l-1-3.1L40 4l3-.8Z" /><path d="m4 40 .9 2.6L8 44l-3.1.9L4 48l-.9-3.1L0 44l3.1-1.4Z" /></g>}
      {shine && <g clipPath={ref("clip")}><g className="milestone-seal__sweep"><path d="M-15-20H-3L42 68H30Z" fill={ref("sweep")} /></g></g>}
    </svg>
  </span>;
}