import { useState } from "react";
import { AX } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { Check } from "lucide-react";

/**
 * One-time quiz shown ONLY before signup. Answers live in localStorage until
 * an account exists, then dashboard/index flushes them onto the profile row.
 * Content is limited to the user's own answers and the real 21-day habit
 * formation range — no fabricated stats, ratings or comparisons.
 */

export const QUIZ_KEY = "axen.quiz.v1";
export const QUIZ_DONE_KEY = "axen.quiz.v1.done";

export type QuizAnswers = {
  goal: string;
  blocker: string;
  habit_count: number;
  source: string;
};

const GOALS = [
  { id: "fitness", label: "Get fit", line: "Training and body discipline" },
  { id: "discipline", label: "Build discipline", line: "Wake early, keep my word" },
  { id: "focus", label: "Deep focus", line: "Work without distraction" },
  { id: "quit_habit", label: "Quit a bad habit", line: "Break the loop for good" },
];

const BLOCKERS = [
  { id: "motivation", label: "Motivation runs out" },
  { id: "time", label: "No time on busy days" },
  { id: "distraction", label: "Phone and distractions" },
  { id: "forget", label: "I simply forget" },
  { id: "one_missed_day", label: "One missed day ends it" },
];

const COUNTS = [1, 2, 3, 4, 5];

const SOURCES = [
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "google", label: "Google" },
  { id: "friend", label: "A friend" },
  { id: "play_store", label: "Play Store" },
  { id: "other", label: "Somewhere else" },
];

const GOAL_LABEL: Record<string, string> = {
  fitness: "getting fit",
  discipline: "building discipline",
  focus: "deep focus",
  quit_habit: "quitting a bad habit",
};

/** Real AXEN missions, ordered per goal — nothing invented. */
const HABITS: Record<string, string[]> = {
  fitness: ["Workout", "No junk food", "Cold shower", "Wake up early", "Deep focus"],
  discipline: ["Wake up early", "Cold shower", "Workout", "No junk food", "Deep focus"],
  focus: ["Deep focus", "Wake up early", "Workout", "No junk food", "Cold shower"],
  quit_habit: ["No junk food", "Deep focus", "Workout", "Wake up early", "Cold shower"],
};

const STAGES = [
  { day: 1, label: "BUILDING", line: "Day one is a decision, not a result. Every habit starts as a deliberate action.", pts: [0.06, 0.14] },
  { day: 21, label: "STRENGTHENING", line: "Habit-formation research describes roughly three weeks as the point where a repeated action starts to feel less effortful.", pts: [0.06, 0.14, 0.42, 0.55] },
  { day: 60, label: "LONG-TERM CONSISTENCY", line: "Lally et al. (2010) found automaticity typically settles in over about two months of repetition — the range varies by person and habit.", pts: [0.06, 0.14, 0.42, 0.55, 0.78, 0.94] },
];

const G1 = "#6C5CE7";
const G2 = "#3B82F6";

function path(pts: number[], w: number, h: number) {
  const step = w / Math.max(1, pts.length - 1);
  return pts.map((p, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${(h - p * h).toFixed(1)}`).join(" ");
}

function StageScreen({ stage, onNext, last }: { stage: typeof STAGES[number]; onNext: () => void; last: boolean }) {
  const W = 300, H = 150;
  const d = path(stage.pts, W, H);
  return (
    <div key={stage.day} style={{ width: "100%", maxWidth: 400, textAlign: "center", animation: "fadeUp .45s ease" }}>
      <div style={{
        fontSize: "clamp(48px, 17vw, 76px)", fontWeight: 800, lineHeight: 1, color: "#FFFFFF",
        textShadow: `0 0 24px ${G1}, 0 0 70px ${G2}88`, letterSpacing: -2,
      }}>
        DAY {stage.day}
      </div>
      <div style={{
        marginTop: 12, fontSize: "clamp(12px, 3.6vw, 15px)", fontWeight: 700, letterSpacing: "clamp(2px, 1vw, 4px)", color: G1,
        textShadow: `0 0 18px ${G1}aa`,
      }}>
        {stage.label}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={170} style={{ marginTop: 26, overflow: "visible" }} aria-hidden="true">
        <defs>
          <linearGradient id="axq-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={G2} />
            <stop offset="100%" stopColor={G1} />
          </linearGradient>
          <filter id="axq-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {[0.25, 0.5, 0.75, 1].map(g => (
          <line key={g} x1="0" y1={H - g * H} x2={W} y2={H - g * H} stroke={AX.border} strokeWidth="1" />
        ))}
        <path
          d={d}
          fill="none"
          stroke="url(#axq-line)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#axq-glow)"
          style={{ strokeDasharray: 900, strokeDashoffset: 900, animation: "axq-draw 1.1s ease forwards" }}
        />
      </svg>

      <div style={{ marginTop: 18, fontSize: 14, color: AX.muted, lineHeight: 1.65, padding: "0 4px" }}>
        {stage.line}
      </div>

      <button onClick={onNext} style={btn(true)}>{last ? "See my plan" : "Continue"}</button>
    </div>
  );
}

function btn(primary: boolean) {
  return {
    width: "100%", minHeight: 50, marginTop: 26, borderRadius: 14, cursor: "pointer",
    background: primary ? AX.accent : "transparent",
    border: `1px solid ${primary ? AX.accent : AX.border}`,
    color: primary ? "#FFFFFF" : AX.muted,
    fontFamily: AX.font, fontSize: 15, fontWeight: 600,
    boxShadow: primary ? `0 0 30px ${G1}55` : "none",
  } as const;
}

function Options({ items, value, onPick }: { items: { id: string; label: string; line?: string }[]; value: string; onPick: (id: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
      {items.map(o => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => { haptic("tap"); onPick(o.id); }}
            style={{
              display: "flex", alignItems: "center", gap: 12, textAlign: "left",
              padding: "14px 16px", minHeight: 52, borderRadius: 14, cursor: "pointer",
              background: on ? "rgba(108,92,231,0.14)" : "#14141C",
              border: `1px solid ${on ? AX.accent : AX.border}`,
              color: AX.text, fontFamily: AX.font,
              boxShadow: on ? `0 0 22px ${G1}44` : "none",
              transition: "border-color .15s ease, background .15s ease",
            }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: 7, flexShrink: 0,
              background: on ? AX.accent : "transparent",
              border: `1px solid ${on ? AX.accent : AX.border}`,
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            }}>{on && <Check size={13} strokeWidth={3} />}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: 500 }}>{o.label}</span>
              {o.line && <span style={{ display: "block", fontSize: 12, color: AX.muted, marginTop: 2 }}>{o.line}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PreSignupQuiz({ onFinish }: { onFinish: (a: QuizAnswers) => void }) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<QuizAnswers>({ goal: "", blocker: "", habit_count: 0, source: "" });

  const TOTAL = 8; // 4 questions + 3 stages + summary
  const next = () => { haptic("tap"); setStep(s => s + 1); };
  const pick = (patch: Partial<QuizAnswers>) => {
    setA(p => ({ ...p, ...patch }));
    setTimeout(() => setStep(s => s + 1), 190);
  };

  const habits = (HABITS[a.goal] || HABITS.discipline).slice(0, a.habit_count || 3);

  const Q = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
    <div style={{ width: "100%", maxWidth: 400, animation: "fadeUp .3s ease" }}>
      <div className="ax-wrap" style={{ fontSize: "clamp(20px, 6vw, 24px)", fontWeight: 600, color: AX.text, lineHeight: 1.3 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: AX.muted, marginTop: 8 }}>{sub}</div>}
      {children}
    </div>
  );

  let body: React.ReactNode = null;

  if (step === 0) body = (
    <Q title="What are you here to build?" sub="Pick the one that matters most right now.">
      <Options items={GOALS} value={a.goal} onPick={id => pick({ goal: id })} />
    </Q>
  );
  else if (step === 1) body = (
    <Q title="What usually makes you stop?" sub="Honest answer works better than the impressive one.">
      <Options items={BLOCKERS} value={a.blocker} onPick={id => pick({ blocker: id })} />
    </Q>
  );
  else if (step === 2) body = (
    <Q title="How many habits do you want to start with?" sub="Fewer habits, done daily, beat a long list.">
      <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
        {COUNTS.map(n => {
          const on = a.habit_count === n;
          return (
            <button key={n} onClick={() => { haptic("tap"); pick({ habit_count: n }); }} style={{
              flex: "1 1 60px", minWidth: 0, minHeight: 62, borderRadius: 14, cursor: "pointer",
              background: on ? AX.accent : "#14141C",
              border: `1px solid ${on ? AX.accent : AX.border}`,
              color: on ? "#FFFFFF" : AX.text, fontFamily: AX.font, fontSize: 20, fontWeight: 600,
              boxShadow: on ? `0 0 22px ${G1}55` : "none",
            }}>{n}</button>
          );
        })}
      </div>
    </Q>
  );
  else if (step === 3) body = (
    <Q title="Where did you hear about AXEN?" sub="This helps us know where to keep showing up.">
      <Options items={SOURCES} value={a.source} onPick={id => pick({ source: id })} />
    </Q>
  );
  else if (step >= 4 && step <= 6) {
    const stage = STAGES[step - 4];
    body = (
      <div style={{ width: "100%", maxWidth: 400 }}>
        {step === 4 && (
          <div style={{ fontSize: 14, color: AX.muted, textAlign: "center", marginBottom: 22, lineHeight: 1.6 }}>
            Based on your goal of <span style={{ color: AX.text, fontWeight: 600 }}>{GOAL_LABEL[a.goal] || "building discipline"}</span> — users who stay consistent for 21 days typically see the habit start to become automatic.
          </div>
        )}
        <StageScreen stage={stage} onNext={next} last={step === 6} />
      </div>
    );
  } else {
    body = (
      <div style={{ width: "100%", maxWidth: 400, animation: "fadeUp .4s ease" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, letterSpacing: 4, fontWeight: 700, color: G1, textShadow: `0 0 16px ${G1}aa` }}>YOUR PLAN IS READY</div>
          <div className="ax-wrap" style={{ fontSize: "clamp(21px, 6.4vw, 26px)", fontWeight: 600, color: AX.text, marginTop: 10, lineHeight: 1.3 }}>
            {a.habit_count} {a.habit_count === 1 ? "habit" : "habits"} for {GOAL_LABEL[a.goal] || "building discipline"}
          </div>
        </div>

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          {habits.map(h => (
            <div key={h} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
              background: "#14141C", border: `1px solid ${AX.border}`, borderRadius: 14, color: AX.text, fontSize: 15,
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: 7, background: AX.accent,
                display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0,
              }}><Check size={13} strokeWidth={3} /></span>
              {h}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, fontSize: 13, color: AX.muted, lineHeight: 1.6, textAlign: "center" }}>
          You told us <span style={{ color: AX.text }}>{(BLOCKERS.find(b => b.id === a.blocker)?.label || "missed days").toLowerCase()}</span> usually stops you. Streak shields and daily reminders in AXEN exist for exactly that.
        </div>

        <button onClick={() => { haptic("success"); onFinish(a); }} style={btn(true)}>Create my account</button>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400, background: AX.bg, overflowY: "auto",
      display: "flex", alignItems: "center", justifyContent: "center", overflowX: "clip",
      padding: "calc(26px + env(safe-area-inset-top,0px)) 20px calc(34px + env(safe-area-inset-bottom,0px))",
      fontFamily: AX.font,
    }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: `radial-gradient(circle at 20% 8%, ${G1}22, transparent 55%), radial-gradient(circle at 84% 92%, ${G2}1e, transparent 55%)` }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", gap: 5, marginBottom: 26 }}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <span key={i} style={{
              flex: 1, height: 3, borderRadius: 3,
              background: i <= step ? AX.accent : AX.border,
              boxShadow: i <= step ? `0 0 10px ${G1}88` : "none",
              transition: "background .25s ease",
            }} />
          ))}
        </div>
        {body}
      </div>
    </div>
  );
}
