import { useState } from "react";
import { Button } from "@/components/ui/button";
import { checkOfflineAnswer, makeOfflineQuestion, nextStreak, OFFLINE_STREAK } from "@/lib/wake-offline-core";
import styles from "./alarm.module.css";

/** Offline stop: 3 phone-made multi-step math questions in a row. Wrong answers keep ringing and show a new question. */
export function OfflineStop({ onSolved }: { onSolved: () => void }) {
  const [q, setQ] = useState(() => makeOfflineQuestion());
  const [streak, setStreak] = useState(0);
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState("");
  const submit = () => {
    const ok = checkOfflineAnswer(q, answer);
    const next = nextStreak(streak, ok);
    setAnswer("");
    if (ok && next >= OFFLINE_STREAK) { onSolved(); return; }
    setStreak(next); setQ(makeOfflineQuestion());
    setMsg(ok ? "Correct. Next question." : "Incorrect. The alarm keeps ringing — new question, streak reset.");
  };
  return <>
    <p className={styles.muted}>OFFLINE STOP · {streak}/{OFFLINE_STREAK} correct in a row</p>
    <div className={styles.question}>{q.text} = ?</div>
    <form className={styles.options} onSubmit={e => { e.preventDefault(); if (answer) submit(); }}>
      <input aria-label="Offline answer" className={styles.input} inputMode="numeric" autoComplete="off" value={answer} onChange={e => setAnswer(e.target.value)} />
      <Button className={`${styles.command} ${styles.primary}`} disabled={!answer} type="submit">Submit answer</Button>
    </form>
    {msg && <p role="status" className={styles.error}>{msg}</p>}
    <p className={styles.muted}>No connection. Coins are confirmed by the server when you're back online.</p>
  </>;
}
