import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AX } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { startAlarm, stopAlarm, isAlarmPlaying } from "@/lib/alarm-audio";
import { Delete, Flame } from "lucide-react";

export type WakeQuestion =
  | { kind: "math"; text: string; answer: number }
  | { kind: "science"; text: string; options: string[]; answer: number };

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

/** Difficulty scales with the tier: 4AM is brutal, 7AM is gentle. */
export function buildMath(tier: string): WakeQuestion {
  const hour = parseInt(tier, 10) || 4;
  const hard = hour <= 5;
  if (hard) {
    const pick = rnd(0, 2);
    if (pick === 0) {
      const a = rnd(12, 39), b = rnd(12, 29);
      return { kind: "math", text: `${a} × ${b} = ?`, answer: a * b };
    }
    if (pick === 1) {
      const x = rnd(4, 19), m = rnd(3, 9), c = rnd(5, 40);
      return { kind: "math", text: `${m}x + ${c} = ${m * x + c}.  x = ?`, answer: x };
    }
    const a = rnd(20, 60), b = rnd(3, 12), c = rnd(5, 40);
    return { kind: "math", text: `(${a} × ${b}) − ${c} = ?`, answer: a * b - c };
  }
  if (hour === 6) {
    const a = rnd(6, 14), b = rnd(4, 12);
    return { kind: "math", text: `${a} × ${b} = ?`, answer: a * b };
  }
  const a = rnd(18, 70), b = rnd(9, 40);
  return Math.random() > 0.5
    ? { kind: "math", text: `${a} + ${b} = ?`, answer: a + b }
    : { kind: "math", text: `${a + b} − ${b} = ?`, answer: a };
}

/** Guaranteed-offline science bank. */
const SCIENCE_BANK: { q: string; o: string[]; a: number }[] = [
  { q: "Which gas do plants absorb for photosynthesis?", o: ["Oxygen", "Carbon dioxide", "Nitrogen", "Helium"], a: 1 },
  { q: "What is the SI unit of force?", o: ["Joule", "Watt", "Newton", "Pascal"], a: 2 },
  { q: "Speed of light in vacuum is about…", o: ["3×10⁸ m/s", "3×10⁵ m/s", "3×10⁶ m/s", "3×10¹⁰ m/s"], a: 0 },
  { q: "Which organ pumps blood through the body?", o: ["Liver", "Lungs", "Heart", "Kidney"], a: 2 },
  { q: "Water freezes at…", o: ["0 °C", "10 °C", "32 °C", "100 °C"], a: 0 },
  { q: "Chemical symbol of sodium?", o: ["S", "So", "Na", "Sn"], a: 2 },
  { q: "Which planet is closest to the Sun?", o: ["Venus", "Mercury", "Mars", "Earth"], a: 1 },
  { q: "Energy stored in a stretched spring is…", o: ["Kinetic", "Thermal", "Potential", "Nuclear"], a: 2 },
  { q: "DNA carries…", o: ["Genetic information", "Oxygen", "Fat", "Minerals"], a: 0 },
  { q: "Acceleration due to gravity on Earth ≈", o: ["4.9 m/s²", "9.8 m/s²", "19.6 m/s²", "1.6 m/s²"], a: 1 },
  { q: "Sound cannot travel through…", o: ["Steel", "Water", "Air", "Vacuum"], a: 3 },
  { q: "Which particle has a negative charge?", o: ["Proton", "Neutron", "Electron", "Photon"], a: 2 },
  { q: "Unit of electric current?", o: ["Volt", "Ampere", "Ohm", "Watt"], a: 1 },
  { q: "The powerhouse of the cell is the…", o: ["Nucleus", "Ribosome", "Mitochondrion", "Vacuole"], a: 2 },
  { q: "Pure water has a pH of about…", o: ["3", "7", "9", "12"], a: 1 },
];

export function buildScience(used: Set<string>): WakeQuestion {
  const pool = SCIENCE_BANK.filter(q => !used.has(q.q));
  const bank = pool.length ? pool : SCIENCE_BANK;
  const item = bank[rnd(0, bank.length - 1)];
  return { kind: "science", text: item.q, options: item.o, answer: item.a };
}

/**
 * Full-screen, non-dismissible wake verification takeover.
 * The alarm loops until a correct answer is given.
 */
export function WakeVerify({ tier, pts, line, toneUrl, mode, onVerified }: {
  tier: string;
  pts: number;
  line: string;
  toneUrl: string;
  mode: "math" | "science";
  onVerified: () => void;
}) {
  const used = useRef<Set<string>>(new Set());
  const [q, setQ] = useState<WakeQuestion>(() => (mode === "science" ? buildScience(used.current) : buildMath(tier)));
  const [input, setInput] = useState("");
  const [wrong, setWrong] = useState(0);
  const [shake, setShake] = useState(false);
  const [won, setWon] = useState(false);

  const next = useCallback(() => {
    used.current.add(q.text);
    setQ(mode === "science" ? buildScience(used.current) : buildMath(tier));
    setInput("");
  }, [mode, tier, q.text]);

  // alarm: start on mount, keep alive, stop only on success/unmount
  useEffect(() => {
    startAlarm(toneUrl);
    const id = window.setInterval(() => { if (!isAlarmPlaying()) startAlarm(toneUrl); }, 4000);
    return () => { window.clearInterval(id); stopAlarm(); };
  }, [toneUrl]);

  // block back button / swipe-back while unsolved
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.pushState({ wake: true }, "");
    const onPop = () => { if (!won) window.history.pushState({ wake: true }, ""); };
    window.addEventListener("popstate", onPop);
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (!won) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [won]);

  const fail = () => {
    haptic("tap");
    setWrong(w => w + 1);
    setShake(true);
    window.setTimeout(() => setShake(false), 420);
    next();
  };

  const succeed = () => {
    stopAlarm();
    setWon(true);
    haptic("success");
    window.setTimeout(onVerified, 1200);
  };

  const submit = () => {
    if (q.kind !== "math" || input === "") return;
    if (Number(input) === q.answer) succeed(); else fail();
  };

  const keys = useMemo(() => ["1", "2", "3", "4", "5", "6", "7", "8", "9", "-", "0", "del"], []);

  return (
    <div className={`wakev ${shake ? "wakev--shake" : ""}`} role="dialog" aria-modal="true" aria-label="Wake verification">
      <div className="wakev__glow" />
      <div className="wakev__inner">
        <div className="wakev__tier"><Flame size={14} /> {tier} WAKE PROTOCOL</div>
        <h1 className={`wakev__title ${won ? "is-won" : ""}`}>{won ? "AWAKE CONFIRMED" : "WAKE UP"}</h1>
        <p className="wakev__sub">
          {won ? `+${pts} coins · ${line}` : `Solve to silence the alarm. +${pts} coins on success.`}
        </p>

        {!won && (
          <>
            <div className="wakev__question">{q.text}</div>

            {q.kind === "math" ? (
              <>
                <div className="wakev__answer">{input || "—"}</div>
                <div className="wakev__pad">
                  {keys.map(k => (
                    <button
                      key={k}
                      className="wakev__key"
                      onClick={() => {
                        haptic("tap");
                        if (k === "del") setInput(s => s.slice(0, -1));
                        else if (k === "-") setInput(s => (s.startsWith("-") ? s.slice(1) : "-" + s));
                        else setInput(s => (s.length < 8 ? s + k : s));
                      }}
                      aria-label={k === "del" ? "Delete" : k}
                    >
                      {k === "del" ? <Delete size={18} /> : k}
                    </button>
                  ))}
                </div>
                <button className="wakev__submit" onClick={submit} disabled={input === ""}>SUBMIT ANSWER</button>
              </>
            ) : (
              <div className="wakev__options">
                {q.options.map((o, i) => (
                  <button key={o} className="wakev__option" onClick={() => (i === q.answer ? succeed() : fail())}>{o}</button>
                ))}
              </div>
            )}

            <div className="wakev__foot">
              {wrong > 0 && <span className="wakev__wrong">{wrong} WRONG · ALARM STILL RINGING</span>}
              <span>NO SNOOZE · NO SKIP · NO ESCAPE</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
