import { useEffect, useRef, useState } from "react";
import { Check, Coins } from "lucide-react";
import styles from "./coin-badge.module.css";

type Props = {
  amount: number;
  variant?: "reward" | "balance" | "amount";
  state?: "available" | "earned" | "disabled";
  surface?: "dark" | "light";
  /** A new server-confirmed ledger/session ID, never a client completion guess. */
  awardId?: string;
};

const celebrated = new Set<string>();
export function CoinBadge({ amount, variant = "reward", state = "available", surface = "dark", awardId }: Props) {
  const previous = useRef(amount);
  const [display, setDisplay] = useState(amount);
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const before = previous.current;
    previous.current = amount;
    if (!awardId || celebrated.has(awardId) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(amount); return;
    }
    const key = `axen:coin-shine:${awardId}`;
    try { if (sessionStorage.getItem(key)) { setDisplay(amount); return; } sessionStorage.setItem(key, "1"); } catch { /* in-memory guard still applies */ }
    celebrated.add(awardId);
    setAnimate(true);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 600);
      setDisplay(variant === "balance" ? Math.round(before + (amount - before) * progress) : Math.round(amount * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const timer = setTimeout(() => setAnimate(false), 850);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [amount, awardId, variant]);
  const label = variant === "balance" ? `Balance: ${amount} coins` : `${state === "earned" ? "Earned" : "Reward"}: ${amount} coins`;
  return <span className={styles.badge} data-state={state} data-surface={surface} data-animate={animate} aria-label={label}>
    <Coins className={styles.icon} aria-hidden="true" />
    <span>{variant === "balance" ? `${display} coins` : variant === "reward" ? `+${display}` : display}</span>
    {state === "earned" && <Check className={styles.check} aria-hidden="true" />}
    {animate && <span className={styles.burst} aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ transform: `rotate(${i * 45}deg)` }} />)}</span>}
  </span>;
}