import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CoinBadge } from "@/components/CoinBadge";
import { readWakeState, submitWakeAnswer } from "@/lib/wake.functions";
import { webAlarmScheduler } from "@/lib/web-alarm-scheduler";
import { WAKE_REASONS } from "@/lib/wake-rules";
import { retryDelayMs, trySendAnswer, type PendingAnswer } from "@/lib/wake-answer-queue";
import type { AlarmEvent, AlarmSubmission } from "@/lib/wake-types";
import styles from "./alarm.module.css";
import superloud from "@/assets/ringtones/the_cutie_pie-super-loud-ahh-alarm-165805_1.mp3.asset.json";
import scariest from "@/assets/ringtones/The_Scariest_Alarm_256k.mp3.asset.json";
import techno from "@/assets/ringtones/techno_beat.mp3.asset.json";
import meduzza from "@/assets/ringtones/MEDUZZA.mp3.asset.json";
import classic from "@/assets/ringtones/Classic.mp3.asset.json";
import morning from "@/assets/ringtones/good_morning.mp3.asset.json";
import retro from "@/assets/ringtones/retro_emergency.wav.asset.json";
import emergency from "@/assets/ringtones/loud_emergency.mp3.asset.json";
import modern from "@/assets/ringtones/Modern_talking.mp3.asset.json";
import oppenheimer from "@/assets/ringtones/Oppenheimer.mp3.asset.json";
const tones: Record<string, string> = Object.fromEntries(Object.entries({ superloud, scariest, techno, meduzza, classic, morning, retro, emergency, modern, oppenheimer }).map(([k, v]) => [k, v.url]));

export function AlarmScreen() {
  const read = useServerFn(readWakeState), submit = useServerFn(submitWakeAnswer), navigate = useNavigate();
  const [event, setEvent] = useState<AlarmEvent | null>(null);
  const [result, setResult] = useState<AlarmSubmission | null>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const state = await read(); webAlarmScheduler.synchronize(state); setLoaded(true);
      if (state.event) {
        setEvent(state.event);
        if (state.event.status === "ringing") await webAlarmScheduler.ring(tones[state.event.tone] ?? superloud.url);
        else if (state.event.status === "solved" && !result?.solved) {
          webAlarmScheduler.stopVerified();
          setResult({ solved: true, correct: true, awarded: 0, result: state.event.result ?? "daily_claimed", event: state.event });
        }
      } else setEvent(null);
    } catch { setError("Connection needed to verify the alarm. Reconnect and try again."); }
  }, [read, result?.solved]);
  useEffect(() => { void refresh(); const id = window.setInterval(refresh, 5000); return () => clearInterval(id); }, [refresh]);
  useEffect(() => {
    if (event?.status !== "ringing" || result?.solved) return;
    const pop = () => { window.history.pushState({ wake: true }, "", "/alarm"); };
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.history.pushState({ wake: true }, "", "/alarm");
    window.addEventListener("popstate", pop); window.addEventListener("beforeunload", unload);
    return () => { window.removeEventListener("popstate", pop); window.removeEventListener("beforeunload", unload); };
  }, [event?.id, result?.solved]);
  // Offline answers wait in memory only and are retried; only a server-confirmed solve stops the alarm.
  const [pending, setPending] = useState<PendingAnswer | null>(null);
  const pendingRef = useRef<PendingAnswer | null>(null), attempts = useRef(0), retryTimer = useRef<number | null>(null), inFlight = useRef(false);
  const clearRetry = () => { if (retryTimer.current !== null) window.clearTimeout(retryTimer.current); retryTimer.current = null; };
  const deliver = useCallback(async (item: PendingAnswer) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); clearRetry();
    try {
      const outcome = await trySendAnswer(item, x => submit({ data: x }), () => navigator.onLine);
      if (outcome.kind === "queued") {
        pendingRef.current = item; setPending(item); attempts.current += 1;
        retryTimer.current = window.setTimeout(() => { if (pendingRef.current) void deliverRef.current(pendingRef.current); }, retryDelayMs(attempts.current));
        return;
      }
      pendingRef.current = null; setPending(null); attempts.current = 0;
      if (outcome.kind === "rejected") { setError(outcome.message); await refresh(); return; }
      const response = outcome.response;
      setEvent(response.event); setAnswer(""); setError("");
      if (response.solved) { webAlarmScheduler.stopVerified(); setResult(response); window.dispatchEvent(new Event("axen:wake-updated")); window.dispatchEvent(new Event("axen:wake-solved")); }
      else setError(response.correct ? "One correct. Solve the next question." : "Incorrect. The alarm keeps ringing. Solve the new question.");
    } finally { inFlight.current = false; setBusy(false); }
  }, [submit, refresh]);
  const deliverRef = useRef(deliver);
  deliverRef.current = deliver;
  useEffect(() => {
    const online = () => { if (pendingRef.current) void deliverRef.current(pendingRef.current); };
    window.addEventListener("online", online);
    return () => { window.removeEventListener("online", online); clearRetry(); };
  }, []);
  const send = async (value: string) => {
    if (!event?.question || busy || pendingRef.current) return;
    setError("");
    await deliver({ eventId: event.id, version: event.question.version, answer: value });
  };
  const locked = busy || pending !== null;
  return <div className={styles.surface} role="dialog" aria-modal="true" aria-label="Wake verification"><div className={styles.inner}>
    <p className={styles.muted}>AXEN · {event?.is_test ? "TEST ALARM" : "WAKE PROTOCOL"}</p>
    <h1 className={styles.title}>{result?.solved ? "AWAKE CONFIRMED" : "WAKE UP"}</h1>
    {result?.solved ? <>
      {(result.awarded ?? 0) > 0 && <CoinBadge amount={result.awarded ?? 0} state="earned" awardId={result.event.id} />}
      <p className={styles.muted}>{WAKE_REASONS[result.result ?? ""] ?? "Alarm solved."}</p>
      <p className={styles.muted}>{result.explanation}</p>
      <Button className={styles.command} onClick={() => navigate({ to: "/dashboard" })}>Continue</Button>
    </> : event?.question ? <>
      <div className={styles.question}>{event.question.text}</div>
      {event.question.type === "science" ? <><p className={styles.muted}>{event.question.correct_in_row}/2 correct in a row</p><div className={styles.options}>{event.question.options?.map((o, i) => <Button key={o} className={styles.command} disabled={locked} onClick={() => send(String(i))}>{o}</Button>)}</div></> : <form className={styles.options} onSubmit={e => { e.preventDefault(); void send(answer); }}><input aria-label="Numeric answer" className={styles.input} inputMode="decimal" autoComplete="off" value={answer} disabled={pending !== null} onChange={e => setAnswer(e.target.value)} /><Button className={`${styles.command} ${styles.primary}`} disabled={locked || !answer} type="submit">{pending ? "Waiting for connection…" : busy ? "Checking…" : "Submit answer"}</Button></form>}
      {pending && <p role="status" data-wake-pending="true" className={styles.error}>No connection. Your answer is waiting and will be sent automatically when you're back online. The alarm keeps ringing until it is verified.</p>}
      <p className={styles.muted}>NO SNOOZE · NO SKIP</p>
      {!webAlarmScheduler.ready && <Button className={styles.command} onClick={async () => { try { await webAlarmScheduler.startOvernight(); } catch { setError("Audio is blocked. Check your browser and volume."); } }}>Enable alarm audio</Button>}
    </> : <><p className={styles.muted}>{loaded ? "No ringing alarm." : "Connecting to your alarm…"}</p>{loaded && <Button className={styles.command} onClick={() => navigate({ to: "/dashboard" })}>Return to protocol</Button>}</>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div></div>;
}