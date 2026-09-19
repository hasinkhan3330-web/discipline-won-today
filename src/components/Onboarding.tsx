import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AX } from "@/tabs/styles";
import { ArrowLeft, ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { haptic } from "@/lib/haptics";

export type OnboardingAnswers = {
  preferred_name?: string; age_range?: string; acquisition_source?: string; primary_goal?: string;
  first_habit?: string; social_hours_daily?: number; biggest_distraction?: string; wake_time?: string;
  sleep_time?: string; consistency_days?: number; routine_breaker?: string; preferred_focus_time?: string;
  commitment_milestone?: 21 | 60 | 90;
};

type Props = { initialStep?: number; initialAnswers?: OnboardingAnswers; onFinish: () => void };
type Step = { key: keyof OnboardingAnswers; eyebrow: string; title: string; options?: { value: string | number; label: string }[]; input?: "text" | "time" | "range"; optional?: boolean };

const STEPS: Step[] = [
  { key: "preferred_name", eyebrow: "Identity", title: "What should AXEN call you?", input: "text" },
  { key: "age_range", eyebrow: "Privacy", title: "Choose your age range", options: [{value:"under_13",label:"Under 13"},{value:"13_17",label:"13–17"},{value:"18_24",label:"18–24"},{value:"25_34",label:"25–34"},{value:"35_44",label:"35–44"},{value:"45_plus",label:"45+"}] },
  { key: "primary_goal", eyebrow: "Mission", title: "What do you want discipline to change first?", options: ["Wake earlier","Focus deeply","Build fitness","Study consistently","Control distractions"].map(value => ({value,label:value})) },
  { key: "first_habit", eyebrow: "First protocol", title: "Name your first daily habit", input: "text" },
  { key: "social_hours_daily", eyebrow: "Attention", title: "Daily social media hours", input: "range" },
  { key: "biggest_distraction", eyebrow: "Obstacle", title: "What breaks your focus most?", options: ["Phone","Procrastination","Low energy","No clear plan","Inconsistent sleep"].map(value => ({value,label:value})) },
  { key: "wake_time", eyebrow: "Morning", title: "Your target wake time", input: "time" },
  { key: "sleep_time", eyebrow: "Recovery", title: "Your target sleep time", input: "time" },
  { key: "consistency_days", eyebrow: "Baseline", title: "How many disciplined days last week?", options: [0,1,2,3,4,5,6,7].map(value => ({value,label:`${value} days`})) },
  { key: "routine_breaker", eyebrow: "Recovery", title: "What usually breaks your routine?", options: ["One missed day","Travel","Stress","Late nights","No accountability"].map(value => ({value,label:value})) },
  { key: "preferred_focus_time", eyebrow: "Focus window", title: "When is your strongest focus?", options: ["Early morning","Morning","Afternoon","Evening","Late night"].map(value => ({value,label:value})) },
  { key: "commitment_milestone", eyebrow: "Commitment", title: "Choose your first milestone", options: [{value:21,label:"21 days · Foundation"},{value:60,label:"60 days · Identity"},{value:90,label:"90 days · Transformation"}] },
];

const SAVE_TIMEOUT_MS = 12_000;
const RETRY_DELAYS_MS = [0, 700, 1_600] as const;

function delay(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function saveStep(stepNumber: number, answers: OnboardingAnswers) {
  let lastError: unknown;
  for (const retryDelay of RETRY_DELAYS_MS) {
    if (retryDelay) await delay(retryDelay);
    try {
      const request = (supabase.rpc as any)("save_onboarding_step", { _step: stepNumber, _answers: answers });
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("Onboarding save timed out")), SAVE_TIMEOUT_MS);
      });
      const { error: saveError } = await Promise.race([request, timeout]);
      if (!saveError) return;
      lastError = saveError;
      if (!/fetch|network|timeout|connection/i.test(saveError.message ?? "")) break;
    } catch (caught) {
      lastError = caught;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Onboarding save failed");
}

export function Onboarding({ initialStep = 1, initialAnswers = {}, onFinish }: Props) {
  const [index, setIndex] = useState(Math.max(0, Math.min(STEPS.length - 1, initialStep - 1)));
  const [answers, setAnswers] = useState<OnboardingAnswers>(initialAnswers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blueprint, setBlueprint] = useState(false);
  const submitting = useRef(false);
  const step = STEPS[index];
  const value = step ? answers[step.key] : undefined;
  const valid = typeof value === "string" ? value.trim().length > 0 : value !== undefined;
  const minor = answers.age_range === "under_13" || answers.age_range === "13_17";
  const progress = Math.round(((index + 1) / STEPS.length) * 100);
  const blueprintLine = useMemo(() => `${answers.commitment_milestone ?? 21}-day ${answers.primary_goal ?? "discipline"} protocol built around ${answers.first_habit || "your first habit"}.`, [answers]);

  const update = (next: string | number) => {
    setError("");
    setAnswers(current => ({ ...current, [step.key]: next }));
  };
  const next = async () => {
    if (!valid || busy || submitting.current || !step) return;
    const cleanAnswers = step.key === "preferred_name"
      ? { ...answers, preferred_name: String(answers.preferred_name ?? "").trim() }
      : answers;
    submitting.current = true;
    haptic("tap"); setBusy(true); setError(""); setAnswers(cleanAnswers);
    try {
      await saveStep(Math.min(13, index + 2), cleanAnswers);
      if (index === STEPS.length - 1) setBlueprint(true); else setIndex(current => current + 1);
    } catch (saveError) {
      console.error("AXEN onboarding save failed", saveError instanceof Error ? saveError.message : "Unknown save error");
      setError("Could not save your progress. Your answer is still here — tap Retry to continue.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const activate = async () => {
    if (busy || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError("");
    try {
      const request = (supabase.rpc as any)("activate_axen_plan", { _answers: answers });
      const timeout = new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Activation timed out")), SAVE_TIMEOUT_MS));
      const { error: activationError } = await Promise.race([request, timeout]);
      if (activationError) throw activationError;
      haptic("success"); onFinish();
    } catch (activationError) {
      console.error("AXEN onboarding activation failed", activationError instanceof Error ? activationError.message : "Unknown activation error");
      setError("Your plan could not be activated. Please retry.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return <div className="ax-onboarding">
    <div className="ax-onboarding__shell">
      <header><span>AXEN SETUP</span><b>{blueprint ? "READY" : `${progress}%`}</b></header>
      <div className="ax-onboarding__progress"><i style={{ width: blueprint ? "100%" : `${progress}%` }} /></div>
      {blueprint ? <section className="ax-blueprint">
        <div className="ax-blueprint__mark"><Sparkles size={30} /></div><span>YOUR PERSONAL BLUEPRINT</span><h1>{answers.preferred_name || "Your"} discipline system is ready.</h1><p>{blueprintLine}</p>
        <div><b>{answers.wake_time || "—"}<small>Wake target</small></b><b>{answers.preferred_focus_time || "—"}<small>Focus window</small></b><b>{answers.commitment_milestone || 21}<small>Day mission</small></b></div>
        {minor && <aside><ShieldCheck size={18} /><span><strong>Safe mode enabled</strong>Your activity stays private with restricted behavioral tracking.</span></aside>}
        {error && <p className="ax-onboarding__error">{error}</p>}
        <button className="ax-onboarding__primary" onClick={activate} disabled={busy}>{busy ? "Activating…" : "Activate my plan"}<ArrowRight size={18}/></button>
      </section> : step && <section className="ax-onboarding__step" key={step.key}>
        <span>{step.eyebrow} · {index + 1} of {STEPS.length}</span><h1>{step.title}</h1>
        {step.options && <div className="ax-onboarding__options">{step.options.map(option => <button key={option.value} className={value === option.value ? "is-selected" : ""} onClick={() => update(option.value)}><span>{option.label}</span>{value === option.value && <Check size={17}/>}</button>)}</div>}
        {step.input === "text" && <input autoFocus maxLength={100} value={String(value ?? "")} onChange={event => update(event.target.value)} placeholder={step.key === "preferred_name" ? "Your name" : "Example: Read 20 minutes"}/>} 
        {step.input === "time" && <input type="time" value={String(value ?? "")} onChange={event => update(event.target.value)}/>} 
        {step.input === "range" && <div className="ax-onboarding__range"><strong>{Number(value ?? 2)} hours</strong><input type="range" min="0" max="12" step="0.5" value={Number(value ?? 2)} onChange={event => update(Number(event.target.value))}/></div>}
        {minor && step.key === "age_range" && <aside><ShieldCheck size={18}/><span>Safe minor mode will limit tracking while keeping onboarding smooth.</span></aside>}
        {error && <p className="ax-onboarding__error">{error}</p>}
        <footer><button onClick={() => setIndex(current => Math.max(0, current - 1))} disabled={index === 0 || busy} aria-label="Previous question"><ArrowLeft size={18}/></button><button className="ax-onboarding__primary" onClick={next} disabled={!valid || busy}>{busy ? "Saving…" : error ? "Retry" : index === STEPS.length - 1 ? "Build my blueprint" : "Continue"}<ArrowRight size={18}/></button></footer>
      </section>}
    </div>
  </div>;
}