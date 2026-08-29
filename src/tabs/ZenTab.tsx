import { AX, cardStyle, titleStyle } from "./styles";
import { Play, Pause, RotateCcw } from "lucide-react";

export function ZenTab({ med }: {
  med: {
    medMin: number; medLeft: number; medRun: boolean;
    setMedRun: React.Dispatch<React.SetStateAction<boolean>>;
    medSessions: number; medTotal: number;
    medPhase: "inhale" | "hold" | "exhale" | "hold2";
    medPhaseLabel: string;
    pickMed: (m: number) => void;
    fmtT: (s: number) => string;
  };
}) {
  const CARD = cardStyle();
  const { medMin, medLeft, medRun, setMedRun, medSessions, medTotal, medPhase, medPhaseLabel, pickMed, fmtT } = med;
  const scale = !medRun ? 0.8 : medPhase === "inhale" ? 1 : medPhase === "exhale" ? 0.7 : 0.95;

  return (
    <>
      <div style={{ padding: "4px 2px 16px" }}>
        <div style={{ fontSize: 24, fontWeight: 600, color: AX.text }}>Zen</div>
        <div style={{ fontSize: 14, color: AX.muted, marginTop: 2 }}>Breathe, reset, return stronger.</div>
      </div>

      <div style={CARD}>
        <div style={titleStyle}>Session length</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[5, 10, 15, 20].map(m => {
            const active = medMin === m;
            return (
              <button key={m} onClick={() => pickMed(m)} disabled={medRun} style={{
                padding: "14px 4px", cursor: medRun ? "not-allowed" : "pointer",
                background: active ? AX.accent : "#181820",
                border: `1px solid ${active ? AX.accent : AX.border}`,
                borderRadius: 14,
                color: active ? "#FFFFFF" : AX.text,
                fontFamily: AX.font,
                opacity: medRun && !active ? 0.5 : 1,
              }}>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{m}</div>
                <div style={{ fontSize: 12, marginTop: 2, color: active ? "#FFFFFF" : AX.muted }}>min</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ ...CARD, textAlign: "center", padding: "28px 18px" }}>
        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            width: 180, height: 180, borderRadius: "50%",
            border: `1.5px solid ${AX.accent}`,
            background: "#181820",
            transform: `scale(${scale})`,
            transition: "transform 3.6s ease-in-out",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: AX.text }}>
              {medRun ? medPhaseLabel.charAt(0) + medPhaseLabel.slice(1).toLowerCase() : "Ready"}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 40, fontWeight: 600, color: AX.text, marginTop: 12, fontVariantNumeric: "tabular-nums" }}>
          {fmtT(medLeft)}
        </div>
        <div style={{ fontSize: 13, color: AX.muted, marginBottom: 20 }}>
          {medRun ? "In session" : "Paused"}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={() => setMedRun(r => !r)} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 24px", cursor: "pointer", borderRadius: 12,
            background: AX.accent, border: `1px solid ${AX.accent}`, color: "#FFFFFF",
            fontFamily: AX.font, fontSize: 14, fontWeight: 600,
          }}>
            {medRun ? <Pause size={16} strokeWidth={2} /> : <Play size={16} strokeWidth={2} />}
            {medRun ? "Pause" : "Begin"}
          </button>
          <button onClick={() => { setMedRun(false); pickMed(medMin); }} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 20px", cursor: "pointer", borderRadius: 12,
            background: "transparent", border: `1px solid ${AX.border}`, color: AX.text,
            fontFamily: AX.font, fontSize: 14, fontWeight: 500,
          }}>
            <RotateCcw size={16} strokeWidth={2} /> Reset
          </button>
        </div>
      </div>

      <div style={CARD}>
        <div style={titleStyle}>Stillness ledger</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {[
            { v: medSessions, l: "Sessions" },
            { v: `${medTotal}m`, l: "Total today" },
            { v: `+${medMin * 2}`, l: "Next reward" },
          ].map(s => (
            <div key={s.l} style={{ background: "#181820", border: `1px solid ${AX.border}`, borderRadius: 14, padding: "14px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: AX.text }}>{s.v}</div>
              <div style={{ fontSize: 12, color: AX.muted, marginTop: 3 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
