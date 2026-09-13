import { useCallback, useEffect, useRef, useState } from "react";
import type { BreathPhase } from "@/components/NeuralWaveCanvas";

type MedTask = { done: boolean; name: string; _uuid?: string } & Record<string, unknown>;
type SessionStatus = "idle" | "running" | "paused" | "complete";

const PHASE_MS = 4000;
const CYCLE_MS = 16000;

export function useMeditation(
  tasks: MedTask[],
  completeTaskRpc: (uuid: string, overridePts?: number) => Promise<void>,
  onSessionComplete?: (minutes: number) => Promise<void> | void,
) {
  const [medMin, setMedMin] = useState(10);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [medSessions, setMedSessions] = useState(0);
  const [medTotal, setMedTotal] = useState(0);
  const [medLifetime, setMedLifetime] = useState(0);
  const startedAtRef = useRef(0);
  const bankedMsRef = useRef(0);
  const liveElapsedRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const completionGuardRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tasksRef = useRef(tasks);
  const completeRef = useRef(completeTaskRpc);
  const sessionRef = useRef(onSessionComplete);
  tasksRef.current = tasks;
  completeRef.current = completeTaskRpc;
  sessionRef.current = onSessionComplete;

  const totalMs = medMin * 60_000;
  const getElapsedMs = useCallback(() => {
    if (status === "running") return Math.min(totalMs, bankedMsRef.current + performance.now() - startedAtRef.current);
    return liveElapsedRef.current;
  }, [status, totalMs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMedLifetime(Number(localStorage.getItem("dwt_med_minutes") || 0));
    try {
      const today = new Date().toISOString().slice(0, 10);
      const stored = JSON.parse(localStorage.getItem("axen_zen_today") || "null") as { date?: string; sessions?: number; minutes?: number } | null;
      if (stored?.date === today) {
        setMedSessions(Number(stored.sessions || 0));
        setMedTotal(Number(stored.minutes || 0));
      }
    } catch {}
  }, []);

  const finishSession = useCallback(async () => {
    if (completionGuardRef.current) return;
    completionGuardRef.current = true;
    liveElapsedRef.current = totalMs;
    bankedMsRef.current = totalMs;
    setElapsedMs(totalMs);
    setStatus("complete");
    setMedSessions(value => {
      const nextSessions = value + 1;
      setMedTotal(minutes => {
        const nextMinutes = minutes + medMin;
        try { localStorage.setItem("axen_zen_today", JSON.stringify({ date: new Date().toISOString().slice(0, 10), sessions: nextSessions, minutes: nextMinutes })); } catch {}
        return nextMinutes;
      });
      return nextSessions;
    });
    setMedLifetime(value => {
      const next = value + medMin;
      try { localStorage.setItem("dwt_med_minutes", String(next)); } catch {}
      return next;
    });
    const medTask = tasksRef.current.find(task => /medit/i.test(task.name));
    if (medTask && !medTask.done && medTask._uuid) await completeRef.current(medTask._uuid);
    resetTimerRef.current = setTimeout(() => {
      liveElapsedRef.current = 0;
      bankedMsRef.current = 0;
      setElapsedMs(0);
      setStatus("idle");
      completionGuardRef.current = false;
    }, 2200);
  }, [medMin, totalMs]);

  useEffect(() => {
    if (status !== "running") return;
    let lastPaint = 0;
    const tick = (now: number) => {
      const next = Math.min(totalMs, bankedMsRef.current + now - startedAtRef.current);
      liveElapsedRef.current = next;
      if (now - lastPaint >= 40 || next >= totalMs) {
        lastPaint = now;
        setElapsedMs(next);
      }
      if (next >= totalMs) {
        void finishSession();
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [finishSession, status, totalMs]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, []);

  const start = useCallback(() => {
    if (status === "complete") return;
    startedAtRef.current = performance.now();
    setStatus("running");
  }, [status]);

  const pause = useCallback(() => {
    if (status !== "running") return;
    const next = Math.min(totalMs, bankedMsRef.current + performance.now() - startedAtRef.current);
    bankedMsRef.current = next;
    liveElapsedRef.current = next;
    setElapsedMs(next);
    setStatus("paused");
  }, [status, totalMs]);

  const restart = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    completionGuardRef.current = false;
    bankedMsRef.current = 0;
    liveElapsedRef.current = 0;
    setElapsedMs(0);
    setStatus("idle");
  }, []);

  const pickMed = useCallback((minutes: number) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    completionGuardRef.current = false;
    bankedMsRef.current = 0;
    liveElapsedRef.current = 0;
    setElapsedMs(0);
    setStatus("idle");
    setMedMin(minutes);
  }, []);

  const cycleMs = elapsedMs % CYCLE_MS;
  const phaseIndex = Math.min(3, Math.floor(cycleMs / PHASE_MS));
  const phases: BreathPhase[] = ["inhale", "holdFull", "exhale", "holdEmpty"];
  const medPhase = phases[phaseIndex] ?? "inhale";
  const phaseElapsedMs = cycleMs % PHASE_MS;
  const phaseProgress = phaseElapsedMs / PHASE_MS;
  const phaseCountdown = Math.max(1, Math.ceil((PHASE_MS - phaseElapsedMs) / 1000));
  const medLeftMs = Math.max(0, totalMs - elapsedMs);

  return {
    medMin,
    medLeft: Math.ceil(medLeftMs / 1000),
    medLeftMs,
    medRun: status === "running",
    medStatus: status,
    medSessions,
    medTotal,
    medLifetime,
    elapsedMs,
    getElapsedMs,
    medPhase,
    phaseProgress,
    phaseCountdown,
    start,
    pause,
    restart,
    pickMed,
    fmtT: (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`,
  };
}