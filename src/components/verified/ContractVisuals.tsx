import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import styles from './contract-visuals.module.css';

export { styles as contractStyles };

export function ContractButton({ children, secondary = false, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return <button {...props} className={`${secondary ? styles.secondary : styles.primary} ${className}`}>{children}{!secondary && <ArrowRight size={19} aria-hidden="true" />}</button>;
}
export function ContractStats({ duration, rescue, level }: { duration: number; rescue: number; level: number }) {
  return <div className={styles.stats}>
    <div className={styles.tile}><span className={styles.mono}>Duration</span><strong>{duration}<small>min</small></strong></div>
    <div className={styles.tile}><span className={styles.mono}>Rescue</span><strong>{rescue}<small>min</small></strong></div>
    <div className={styles.tile}><span className={styles.mono}>Level</span><strong>{level}<small>/3</small></strong><div className={styles.pips} aria-hidden="true">{[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= level ? styles.filled : ''} />)}</div></div>
  </div>;
}
export function ContractRing({ duration, completed }: { duration: number; completed: boolean }) {
  return <div className={styles.ring}><svg viewBox="0 0 132 132" aria-hidden="true"><circle className={styles.orbit} cx="66" cy="66" r="63" /><circle className={styles.track} cx="66" cy="66" r="53" /><circle className={`${styles.arc} ${completed ? styles.arcComplete : ''}`} cx="66" cy="66" r="53" pathLength="100" /></svg><div>{completed ? <ShieldCheck size={39} strokeWidth={1.8} /> : <strong>{duration}</strong>}<span className={styles.mono}>{completed ? 'Sealed' : 'Min'}</span></div></div>;
}
export function ContractStep({ number, label, complete, children }: { number: number; label: string; complete: boolean; children: ReactNode }) {
  return <section className={styles.step}><span className={`${styles.node} ${complete ? styles.nodeComplete : ''}`} aria-hidden="true">{String(number).padStart(2, '0')}</span><div className={styles.stepBody}><div className={`${styles.mono} ${styles.stepLabel}`}>{label}</div>{children}</div></section>;
}
