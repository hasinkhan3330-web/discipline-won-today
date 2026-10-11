import { Button } from "@/components/ui/button";
import styles from "./eclipse.module.css";

export function SessionCard({ minutes, caption, selected, disabled, onSelect }: {minutes: number; caption: string; selected: boolean; disabled: boolean; onSelect: () => void}) {
  return <div className={styles.sessionWrap} data-selected={selected}>
    <Button variant="ghost" className={styles.sessionCard} aria-pressed={selected} aria-label={`${minutes} minutes · ${caption}`} disabled={disabled} onClick={onSelect}>
      <svg viewBox="0 0 30 30" fill="none" aria-hidden="true"><circle className={styles.glyphTrack} cx="15" cy="15" r="11"/><circle className={styles.glyphProgress} cx="15" cy="15" r="11" strokeWidth="2" strokeLinecap="round" pathLength="100" strokeDasharray={minutes === 20 ? undefined : `${minutes * 5} ${100 - minutes * 5}`} transform="rotate(-90 15 15)"/><circle className={styles.glyphDisc} cx="15" cy="15" r="7"/></svg>
      <strong>{minutes}</strong><small>MIN</small><span>{caption}</span>
    </Button>
  </div>;
}