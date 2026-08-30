import { useState } from "react";
import { AX } from "@/tabs/styles";
import { Coins, Flame, Shield, Rocket } from "lucide-react";
import { haptic } from "@/lib/haptics";

const SCREENS = [
  { Icon: Rocket, title: "Welcome to AXEN", line: "One screen, five missions, zero excuses. Finish your habits each day and the system tracks the rest." },
  { Icon: Coins, title: "Coins reward the work", line: "Every completed habit pays coins. Coins raise your tier and unlock the leaderboard position you actually earned." },
  { Icon: Flame, title: "Streaks measure consistency", line: "Complete your day and your streak grows. Miss a day and it resets — that is the whole point." },
  { Icon: Shield, title: "Shields protect one bad day", line: "Buy a shield with coins. If life breaks a day, spend one to keep the streak alive. Maximum three at a time." },
];

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [i, setI] = useState(0);
  const s = SCREENS[i];
  const last = i === SCREENS.length - 1;

  const next = () => {
    haptic("tap");
    if (last) onFinish();
    else setI(n => n + 1);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500, background: AX.bg,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 22,
      fontFamily: AX.font,
    }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div key={i} style={{ textAlign: "center", animation: "fadeUp .3s ease" }}>
          <div style={{
            width: 68, height: 68, borderRadius: 20, margin: "0 auto",
            background: "#181820", border: `1px solid ${AX.border}`, color: AX.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <s.Icon size={30} strokeWidth={1.7} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: AX.text, marginTop: 20 }}>{s.title}</div>
          <div style={{ fontSize: 14, color: AX.muted, marginTop: 10, lineHeight: 1.6 }}>{s.line}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 7, marginTop: 26 }}>
          {SCREENS.map((_, n) => (
            <span key={n} style={{
              width: n === i ? 20 : 7, height: 7, borderRadius: 7,
              background: n === i ? AX.accent : AX.border, transition: "width .25s ease, background .25s ease",
            }} />
          ))}
        </div>

        <button
          onClick={next}
          style={{
            width: "100%", minHeight: 48, marginTop: 26, borderRadius: 14, cursor: "pointer",
            background: AX.accent, border: `1px solid ${AX.accent}`, color: "#FFFFFF",
            fontFamily: AX.font, fontSize: 15, fontWeight: 600,
          }}
        >
          {last ? "Start my first day" : "Next"}
        </button>

        <button
          onClick={onFinish}
          style={{
            width: "100%", minHeight: 44, marginTop: 10, borderRadius: 14, cursor: "pointer",
            background: "transparent", border: "none", color: AX.muted,
            fontFamily: AX.font, fontSize: 13, fontWeight: 500,
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
