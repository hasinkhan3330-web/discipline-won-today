import { useEffect, useState } from "react";

type MedTask = { done: boolean; name: string; _uuid?: string } & Record<string, any>;

export function useMeditation(
  tasks: MedTask[],
  completeTaskRpc: (uuid: string, overridePts?: number) => Promise<void>,
) {
  const [medMin, setMedMin] = useState(5);
  const [medLeft, setMedLeft] = useState(5 * 60);
  const [medRun, setMedRun] = useState(false);
  const [medSessions, setMedSessions] = useState(0);
  const [medTotal, setMedTotal] = useState(0);
  const [medLifetime, setMedLifetime] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMedLifetime(Number(localStorage.getItem("dwt_med_minutes") || 0));
  }, []);


  useEffect(() => {
    if (!medRun) return;
    const id = setInterval(() => {
      setMedLeft(s => {
        if (s <= 1) {
          setMedRun(false);
          setMedSessions(x => x + 1);
          setMedTotal(x => x + medMin);
          const medTask = tasks.find(t => /medit/i.test(t.name));
          if (medTask && !medTask.done && medTask._uuid) completeTaskRpc(medTask._uuid);
          return medMin * 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [medRun, medMin, tasks, completeTaskRpc]);

  // WHO-style box breathing 4-4-4-4
  const elapsed = medMin * 60 - medLeft;
  const phaseSec = elapsed % 16;
  const medPhase: "inhale" | "hold" | "exhale" | "hold2" =
    phaseSec < 4 ? "inhale" : phaseSec < 8 ? "hold" : phaseSec < 12 ? "exhale" : "hold2";
  const medPhaseLabel = medPhase === "inhale" ? "INHALE" : medPhase === "exhale" ? "EXHALE" : "HOLD";

  const pickMed = (m: number) => { setMedMin(m); setMedLeft(m * 60); setMedRun(false); };
  const fmtT = (s: number) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  return {
    medMin, medLeft, medRun, setMedRun, medSessions, medTotal,
    medPhase, medPhaseLabel, pickMed, fmtT,
  };
}
