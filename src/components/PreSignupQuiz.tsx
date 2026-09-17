import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  Clock3,
  Dumbbell,
  Gamepad2,
  GraduationCap,
  Heart,
  Lightbulb,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Youtube,
  Zap,
} from "lucide-react";
import { haptic } from "@/lib/haptics";
import axenLogo from "@/assets/axen-logo.png";

export const QUIZ_KEY = "axen.first-launch.v2";
export const QUIZ_DONE_KEY = "axen.first-launch.v2.done";
const DRAFT_KEY = "axen.first-launch.v2.draft";

export type QuizAnswers = {
  age: number;
  phone_hours: string;
  social_hours: string;
  screen_control: number;
  discipline: number;
  procrastination: string;
  distraction: string;
  wasted_time: string;
  habit: string;
  goal: string;
};

export type AssessmentResults = {
  dailyLost: number;
  weeklyLost: number;
  yearlyLost: number;
  dailyReclaim: number;
  baseline: number;
};

type Props = { onFinish: (answers: QuizAnswers) => void; onSkip?: () => void };
type Option = { value: string; label: string; icon?: React.ComponentType<{ size?: number }> };

const EMPTY: QuizAnswers = {
  age: 20,
  phone_hours: "",
  social_hours: "",
  screen_control: 5,
  discipline: 5,
  procrastination: "",
  distraction: "",
  wasted_time: "",
  habit: "",
  goal: "",
};

const HOUR_OPTIONS: Option[] = [
  { value: "0.5", label: "Less than 1 hour", icon: Clock3 },
  { value: "1.5", label: "1–2 hours", icon: Clock3 },
  { value: "3", label: "2–4 hours", icon: Clock3 },
  { value: "5", label: "4–6 hours", icon: Clock3 },
  { value: "7", label: "6+ hours", icon: Clock3 },
];

const WASTE_OPTIONS: Option[] = [
  { value: "0.25", label: "Less than 30 min", icon: Clock3 },
  { value: "0.75", label: "30–60 min", icon: Clock3 },
  { value: "1.5", label: "1–2 hours", icon: Clock3 },
  { value: "3", label: "2–4 hours", icon: Clock3 },
  { value: "5", label: "4+ hours", icon: Clock3 },
];

const PROCRASTINATION: Option[] = [
  { value: "never", label: "Never", icon: Zap },
  { value: "sometimes", label: "Sometimes", icon: Clock3 },
  { value: "often", label: "Often", icon: TrendingUp },
  { value: "daily", label: "Almost every day", icon: Smartphone },
];

const DISTRACTIONS: Option[] = [
  { value: "Social Media", label: "Social Media", icon: Users },
  { value: "YouTube", label: "YouTube", icon: Youtube },
  { value: "Gaming", label: "Gaming", icon: Gamepad2 },
  { value: "Phone", label: "Phone", icon: Smartphone },
  { value: "Entertainment", label: "Entertainment", icon: Sparkles },
  { value: "Procrastination", label: "Procrastination", icon: Clock3 },
  { value: "Other", label: "Other", icon: Target },
];

const GOALS: Option[] = [
  { value: "Study", label: "Study", icon: GraduationCap },
  { value: "Work", label: "Work", icon: BriefcaseBusiness },
  { value: "Fitness", label: "Fitness", icon: Dumbbell },
  { value: "Business", label: "Business", icon: TrendingUp },
  { value: "Family", label: "Family", icon: Heart },
  { value: "Learning", label: "Learning", icon: BookOpen },
  { value: "Personal Growth", label: "Personal Growth", icon: Lightbulb },
  { value: "Other", label: "Other", icon: Sparkles },
];

const ANALYSIS_LINES = [
  "ANALYZING YOUR TIME...",
  "ANALYZING YOUR HABITS...",
  "CALCULATING YOUR POTENTIAL...",
  "BUILDING YOUR AXEN PROFILE...",
];

export function calculateAssessment(a: QuizAnswers): AssessmentResults {
  const phone = Number(a.phone_hours) || 0;
  const social = Number(a.social_hours) || 0;
  const statedWaste = Number(a.wasted_time) || 0;
  const procrastinationFactor = ({ never: 0.1, sometimes: 0.28, often: 0.48, daily: 0.68 } as Record<string, number>)[a.procrastination] ?? 0.3;
  const lowControl = (10 - a.screen_control) / 10;
  const lowDiscipline = (10 - a.discipline) / 10;
  const behaviorEstimate = Math.min(phone, social + phone * 0.22) * (0.32 + lowControl * 0.28 + procrastinationFactor * 0.25);
  const dailyLost = Math.max(0.25, Math.min(phone, statedWaste * 0.62 + behaviorEstimate * 0.38));
  const baseline = Math.round(Math.max(8, Math.min(92, a.discipline * 6 + a.screen_control * 4 - procrastinationFactor * 18)));
  const dailyReclaim = Math.min(dailyLost, dailyLost * (0.42 + (a.discipline + a.screen_control) / 100));
  return {
    dailyLost: round(dailyLost),
    weeklyLost: round(dailyLost * 7),
    yearlyLost: Math.round(dailyLost * 365),
    dailyReclaim: round(dailyReclaim),
    baseline,
  };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function readDraft(): { step: number; answers: QuizAnswers } {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as { step?: number; answers?: Partial<QuizAnswers> } | null;
    return { step: Math.max(0, Math.min(10, parsed?.step ?? 0)), answers: { ...EMPTY, ...parsed?.answers } };
  } catch {
    return { step: 0, answers: EMPTY };
  }
}

function OptionList({ options, value, onChange }: { options: Option[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="fl-options">
      {options.map((option) => {
        const active = value === option.value;
        const Icon = option.icon;
        return (
          <button key={option.value} type="button" className={`fl-option${active ? " is-active" : ""}`} onClick={() => { haptic("tap"); onChange(option.value); }}>
            <span className="fl-option__icon">{Icon && <Icon size={17} />}</span>
            <span>{option.label}</span>
            <span className="fl-option__check">{active && <Check size={13} />}</span>
          </button>
        );
      })}
    </div>
  );
}

function ScoreSelector({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <div className="fl-score">
      <div className="fl-score__halo" aria-hidden="true"><span>{value}</span><small>/10</small></div>
      <div className="fl-score__numbers" aria-label={label}>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
          <button key={score} type="button" className={score === value ? "is-active" : ""} onClick={() => { haptic("tap"); onChange(score); }}>{score}</button>
        ))}
      </div>
    </div>
  );
}

function Ring({ value, label }: { value: number; label: string }) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div className="fl-ring" style={{ "--fl-progress": `${bounded * 3.6}deg` } as React.CSSProperties}>
      <div><strong>{Math.round(value)}</strong><small>{label}</small></div>
    </div>
  );
}

function LineGraph({ rising }: { rising: boolean }) {
  const d = rising ? "M8 108 C42 98,55 88,78 82 S122 72,146 49 S191 50,222 15" : "M8 20 C43 32,58 42,80 52 S122 65,146 76 S190 91,222 109";
  return (
    <svg className="fl-graph" viewBox="0 0 230 120" role="img" aria-label={rising ? "Projected improvement graph" : "Current pattern graph"}>
      {[24, 48, 72, 96].map((y) => <line key={y} x1="4" y1={y} x2="226" y2={y} />)}
      <path d={d} className={rising ? "is-rising" : "is-falling"} />
    </svg>
  );
}

export function PreSignupQuiz({ onFinish, onSkip }: Props) {
  const [initial] = useState(readDraft);
  const [step, setStep] = useState(initial.step);
  const [answers, setAnswers] = useState<QuizAnswers>(initial.answers);
  const [analysisIndex, setAnalysisIndex] = useState(0);
  const results = useMemo(() => calculateAssessment(answers), [answers]);
  const questionNumber = step >= 1 && step <= 10 ? step : 0;

  useEffect(() => {
    if (step <= 10) {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, answers })); } catch { /* storage can be unavailable */ }
    }
  }, [answers, step]);

  useEffect(() => {
    if (step !== 11) return;
    setAnalysisIndex(0);
    const timers = [900, 1800, 2700, 3800].map((delay, index) => window.setTimeout(() => {
      if (index === 3) setStep(12);
      else setAnalysisIndex(index + 1);
    }, delay));
    return () => timers.forEach(window.clearTimeout);
  }, [step]);

  const patch = <K extends keyof QuizAnswers>(key: K, value: QuizAnswers[K]) => setAnswers((current) => ({ ...current, [key]: value }));
  const next = () => { haptic("tap"); setStep((current) => current + 1); };
  const back = () => { haptic("tap"); setStep((current) => Math.max(0, current - 1)); };
  const valid = step === 0 || (step === 1 && answers.age >= 10 && answers.age <= 100) ||
    (step === 2 && !!answers.phone_hours) || (step === 3 && !!answers.social_hours) ||
    step === 4 || step === 5 || (step === 6 && !!answers.procrastination) ||
    (step === 7 && !!answers.distraction) || (step === 8 && !!answers.wasted_time) ||
    (step === 9 && answers.habit.trim().length >= 2) || (step === 10 && !!answers.goal);

  const finish = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    haptic("success");
    onFinish(answers);
  };

  const shell = (title: string, subtitle: string | undefined, body: React.ReactNode) => (
    <section className="fl-panel" key={step}>
      <div className="fl-panel__copy">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="fl-panel__body">{body}</div>
    </section>
  );

  let content: React.ReactNode;
  if (step === 0) {
    content = (
      <section className="fl-welcome">
        <img src={axenLogo} alt="AXEN Habit & Discipline" />
        <span>HABIT &amp; DISCIPLINE</span>
        <h1>DISCIPLINE TODAY.<br />FREEDOM TOMORROW.</h1>
        <p>Let’s understand how you use your time, then reveal what you could reclaim.</p>
        <div className="fl-orbit" aria-hidden="true"><i /><b /><em /></div>
        <button type="button" className="fl-primary" onClick={next}>LET’S START <ArrowRight size={17} /></button>
        {onSkip && <button type="button" className="fl-skip" onClick={onSkip}>I already have an account — sign in</button>}
      </section>
    );
  } else if (step === 1) {
    content = shell("What is your age?", "Your age helps us personalize your journey.", (
      <div className="fl-age">
        <button type="button" onClick={() => patch("age", Math.max(10, answers.age - 1))} aria-label="Decrease age">−</button>
        <div><span>{answers.age - 1}</span><strong>{answers.age}</strong><span>{answers.age + 1}</span></div>
        <button type="button" onClick={() => patch("age", Math.min(100, answers.age + 1))} aria-label="Increase age">+</button>
      </div>
    ));
  } else if (step === 2) content = shell("How many hours do you spend on your phone every day?", "Include apps, browsing and entertainment.", <OptionList options={HOUR_OPTIONS} value={answers.phone_hours} onChange={(value) => patch("phone_hours", value)} />);
  else if (step === 3) content = shell("How many hours do you spend on social media every day?", "Be honest. It helps us calculate your baseline.", <OptionList options={HOUR_OPTIONS} value={answers.social_hours} onChange={(value) => patch("social_hours", value)} />);
  else if (step === 4) content = shell("Out of 10, how much control do you have over your screen time?", "Choose the number that feels true today.", <ScoreSelector value={answers.screen_control} onChange={(value) => patch("screen_control", value)} label="Screen time control score" />);
  else if (step === 5) content = shell("Out of 10, how disciplined are you right now?", "It’s okay to be honest. This is your starting point.", <ScoreSelector value={answers.discipline} onChange={(value) => patch("discipline", value)} label="Current discipline score" />);
  else if (step === 6) content = shell("How often do you procrastinate?", "Choose what reflects most days.", <OptionList options={PROCRASTINATION} value={answers.procrastination} onChange={(value) => patch("procrastination", value)} />);
  else if (step === 7) content = shell("Which distraction steals the most of your time?", "Select the strongest pattern.", <OptionList options={DISTRACTIONS} value={answers.distraction} onChange={(value) => patch("distraction", value)} />);
  else if (step === 8) content = shell("How much time do you feel you waste every day?", "Your estimate helps ground the calculation.", <OptionList options={WASTE_OPTIONS} value={answers.wasted_time} onChange={(value) => patch("wasted_time", value)} />);
  else if (step === 9) content = shell("What is the ONE habit you most want to build?", "Make it specific and meaningful to you.", (
    <div className="fl-input-wrap"><Target size={20} /><input autoFocus maxLength={80} value={answers.habit} onChange={(event) => patch("habit", event.target.value)} placeholder="Example: Study for 60 minutes" /></div>
  ));
  else if (step === 10) content = shell("If you had 2 extra hours every day, what would you use them for?", "Choose the goal that matters most.", <OptionList options={GOALS} value={answers.goal} onChange={(value) => patch("goal", value)} />);
  else if (step === 11) {
    content = (
      <section className="fl-analysis">
        <span>PERSONAL SYSTEM CALIBRATION</span>
        <h1>{ANALYSIS_LINES[analysisIndex]}</h1>
        <div className="fl-brain" aria-hidden="true"><i /><i /><i /><i /><b>{Math.min(96, 24 + analysisIndex * 24)}%</b></div>
        <div className="fl-analysis__list">
          {ANALYSIS_LINES.map((line, index) => <p key={line} className={index <= analysisIndex ? "is-done" : ""}>{index < analysisIndex ? <Check size={13} /> : <span />}{line.replace("...", "")}</p>)}
        </div>
      </section>
    );
  } else if (step === 12) {
    content = shell("YOUR TIME", "Estimated — Based on your answers", (
      <div className="fl-time-result">
        <Ring value={Math.min(100, results.dailyLost * 18)} label="TIME LOSS" />
        <div className="fl-metrics">
          <div><span>ESTIMATED DAILY TIME LOST</span><strong>{results.dailyLost}h</strong></div>
          <div><span>ESTIMATED WEEKLY TIME LOST</span><strong>{results.weeklyLost}h</strong></div>
          <div><span>ESTIMATED YEARLY TIME LOST</span><strong>{results.yearlyLost}h</strong></div>
          <div className="is-positive"><span>POTENTIAL TIME TO RECLAIM</span><strong>{results.dailyReclaim}h/day</strong></div>
        </div>
      </div>
    ));
  } else if (step === 13) {
    const points = [results.baseline, Math.max(8, results.baseline - 5), Math.max(6, results.baseline - 12), Math.max(4, results.baseline - 22)];
    content = shell("YOUR CURRENT TRAJECTORY", "If today’s patterns continue unchanged.", (
      <div className="fl-trajectory">
        <LineGraph rising={false} />
        <div className="fl-axis">{["TODAY", "30 DAYS", "90 DAYS", "1 YEAR"].map((label, index) => <span key={label}><b>{points[index]}</b>{label}</span>)}</div>
        <p>Based on your current discipline, screen control and procrastination answers.</p>
      </div>
    ));
  } else if (step === 14) {
    content = shell("WHAT COULD CHANGE?", "AXEN scenario projection", (
      <div>
        <div className="fl-compare">
          <article className="is-current"><span>CURRENT PATTERN</span><LineGraph rising={false} /><p>Distraction<br />Inconsistency<br />Time Loss<br />Missed Habits</p></article>
          <div className="fl-vs">VS</div>
          <article className="is-axen"><span>AXEN SCENARIO</span><LineGraph rising /><p>Focus<br />Consistency<br />Better Habits<br />Reclaimed Time<br />Higher Productivity</p></article>
        </div>
        <p className="fl-disclaimer">This is a projection based on your answers, not a guaranteed result.</p>
      </div>
    ));
  } else if (step === 15) {
    const rows = [
      ["Age", `${answers.age}`], ["Discipline Score", `${answers.discipline}/10`],
      ["Phone Time", HOUR_OPTIONS.find((o) => o.value === answers.phone_hours)?.label ?? "—"],
      ["Social Media Time", HOUR_OPTIONS.find((o) => o.value === answers.social_hours)?.label ?? "—"],
      ["Estimated Time Lost", `${results.dailyLost}h/day`], ["Main Distraction", answers.distraction],
      ["Habit To Build", answers.habit], ["Primary Goal", answers.goal],
      ["Potential Time To Reclaim", `${results.dailyReclaim}h/day`],
    ];
    content = shell("YOUR AXEN PROFILE", "Here’s what we know about your starting point.", (
      <div className="fl-profile">
        <div className="fl-profile__rows">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        <div className="fl-baseline"><Ring value={results.baseline} label="/100" /><div><span>YOUR STARTING BASELINE</span><strong>{results.baseline} / 100</strong><small>Estimated — Based on your answers</small></div></div>
      </div>
    ));
  } else {
    content = (
      <section className="fl-final">
        <img src={axenLogo} alt="AXEN Habit & Discipline" />
        <span>YOUR PROFILE IS READY</span>
        <h1>YOU KNOW WHERE YOU ARE.</h1>
        <h2>NOW BUILD WHERE YOU WANT TO GO.</h2>
        <div className="fl-final__mission"><Target size={22} /><div><small>HABIT TO BUILD</small><strong>{answers.habit}</strong></div></div>
        <div className="fl-final__mission"><Sparkles size={22} /><div><small>TIME RECLAIMED FOR</small><strong>{answers.goal}</strong></div></div>
        <button type="button" className="fl-primary" onClick={finish}>ENTER AXEN <ArrowRight size={17} /></button>
      </section>
    );
  }

  const showNavigation = step >= 1 && step <= 10;
  const showResultsNavigation = step >= 12 && step <= 15;
  return (
    <div className="fl-root">
      <div className="fl-grid" aria-hidden="true" />
      <div className="fl-scanline" aria-hidden="true" />
      <main className="fl-shell">
        {questionNumber > 0 && (
          <header className="fl-progress">
            <span>{String(questionNumber).padStart(2, "0")}/10</span>
            <div>{Array.from({ length: 10 }, (_, index) => <i key={index} className={index < questionNumber ? "is-on" : ""} />)}</div>
          </header>
        )}
        {content}
        {(showNavigation || showResultsNavigation) && (
          <footer className="fl-nav">
            <button type="button" className="fl-back" onClick={back} aria-label="Go back"><ArrowLeft size={18} /></button>
            <button type="button" className="fl-primary" disabled={showNavigation && !valid} onClick={next}>{step === 10 ? "FINISH" : "NEXT"} <ArrowRight size={17} /></button>
          </footer>
        )}
      </main>
    </div>
  );
}