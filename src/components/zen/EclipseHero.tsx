import type { CSSProperties } from "react";
import styles from "./eclipse.module.css";

export function EclipseHero({ session = false, scale = 1, progress = 0, preset = "theta", intensity = 1, children }: {
  session?: boolean; scale?: number; progress?: number; preset?: string; intensity?: number; children?: React.ReactNode;
}) {
  return <div className={styles.hero} data-session={session} data-preset={session ? preset : undefined}>
    <svg width="390" height="430" viewBox="0 0 390 430" role="img" aria-label="Solar eclipse: a black disc with a luminous corona ring">
      <defs>
        <radialGradient id="zen-co"><stop offset="0" stopColor="#fff"/><stop offset=".53" stopColor="#fff"/><stop offset=".57" stopColor="#fff" stopOpacity=".95"/><stop offset=".64" stopColor="#F6DDA0" stopOpacity=".5"/><stop offset=".8" stopColor="#6f9bff" stopOpacity=".15"/><stop offset="1" stopColor="#6f9bff" stopOpacity="0"/></radialGradient>
        <linearGradient id="zen-rg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#9fd8ff"/><stop offset=".5" stopColor="#fff"/><stop offset="1" stopColor="#E9C46A"/></linearGradient>
        <radialGradient id="zen-fl"><stop offset="0" stopColor="#fff" stopOpacity=".9"/><stop offset="1" stopColor="#E9C46A" stopOpacity="0"/></radialGradient>
        <radialGradient id="zen-vg" cx=".5" cy=".5" r=".6"><stop offset="0" stopColor="#101536" stopOpacity=".9"/><stop offset="1" stopColor="#05060A" stopOpacity="0"/></radialGradient>
        <filter id="zen-n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .5 0"/></filter>
      </defs>
      <circle cx="195" cy="230" r="200" fill="url(#zen-vg)"/>
      <g fill="#dfe8ff"><circle cx="30" cy="40" r="1"/><circle cx="84" cy="96" r="1.1" className="zen-tw"/><circle cx="130" cy="30" r=".8"/><circle cx="268" cy="38" r="1" className="zen-tw" style={{animationDelay:"-2s"}}/><circle cx="330" cy="92" r=".9"/><circle cx="364" cy="44" r="1.2" className="zen-tw" style={{animationDelay:"-3s"}}/><circle cx="20" cy="150" r=".8"/><circle cx="372" cy="170" r="1" className="zen-tw" style={{animationDelay:"-1s"}}/><circle cx="56" cy="300" r="1"/><circle cx="346" cy="320" r=".9" className="zen-tw" style={{animationDelay:"-4s"}}/><circle cx="24" cy="388" r=".8"/><circle cx="210" cy="26" r=".7"/><circle cx="110" cy="380" r=".8" className="zen-tw" style={{animationDelay:"-2.5s"}}/><circle cx="300" cy="400" r="1"/></g>
      <g fill="none" stroke="#8fb4ff"><circle className="zen-rp" cx="195" cy="230" r="130" strokeOpacity=".5"/><circle className="zen-rp" cx="195" cy="230" r="130" strokeOpacity=".5" style={{animationDelay:"-5s"}}/></g>
      <g className="zen-rt"><circle cx="195" cy="230" r="108" fill="none" stroke="#fff" strokeOpacity=".28" strokeDasharray="1 5.2"/></g>
      <circle cx="195" cy="230" r="150" fill="none" stroke="#fff" strokeOpacity=".06"/><circle cx="195" cy="230" r="130" fill="none" stroke="#fff" strokeOpacity=".05"/>
      <g className="zen-br" style={session ? {transform:`scale(${scale})`, opacity: intensity} as CSSProperties : undefined}><circle cx="195" cy="230" r="140" fill="url(#zen-co)"/><circle className={styles.coronaRing} cx="195" cy="230" r="77" fill="none" stroke="url(#zen-rg)" strokeWidth="1.6" style={{filter:"drop-shadow(0 0 6px rgba(255,255,255,.53))"}}/></g>
      <circle cx="195" cy="230" r="76" fill="#020308"/><circle cx="195" cy="230" r="75" fill="none" stroke="#000" strokeWidth="2"/>
      <circle cx="245" cy="171" r="22" fill="url(#zen-fl)" className="zen-tw"/><g stroke="#fff" strokeLinecap="round" strokeOpacity=".9"><path d="M245 155v32M229 171h32" strokeWidth="1"/><path d="M234 160l22 22M256 160l-22 22" strokeWidth=".6" opacity=".6"/></g><circle cx="245" cy="171" r="2.2" fill="#fff"/>
      <rect width="390" height="430" filter="url(#zen-n)" opacity=".05"/>
      {session && <circle className={styles.progress} cx="195" cy="230" r="108" pathLength="100" strokeDasharray={`${progress * 100} 100`} transform="rotate(-90 195 230)"/>}
    </svg>
    {children ?? <><div className={styles.zenTitle}>ZEN</div><div className={styles.heroCopy}><div>Breathe · Relax · Manifest</div><p>A calm mind builds a stronger you.</p></div></>}
  </div>;
}