import { cardStyle, titleStyle } from "./styles";

export function ZenTab({ G, G2, med }: {
  G: string; G2: string;
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
  const CARD = cardStyle(G);
  const TITLE = titleStyle;
  const { medMin, medLeft, medRun, setMedRun, medSessions, medTotal, medPhase, medPhaseLabel, pickMed, fmtT } = med;

  return (
    <>
      <div style={{ ...CARD, textAlign: "center", padding: "18px 14px 22px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center, ${G}18, transparent 65%)`, pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ fontSize: 10, letterSpacing: 5, color: G, marginBottom: 4 }}>◈ COSMIC STILLNESS ◈</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: 3, textShadow: `0 0 14px ${G}` }}>ZEN PROTOCOL</div>
          <div style={{ fontSize: 10, color: "#888", letterSpacing: 2, marginTop: 4, marginBottom: 6 }}>BREATHE · RESET · RETURN STRONGER</div>
        </div>
      </div>

      <div style={CARD}>
        <div style={TITLE}><span style={{ color: G }}>▸</span> SESSION <span style={{ color: G }}>LENGTH</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {[5, 10, 15, 20].map(m => {
            const active = medMin === m;
            return (
              <button key={m} onClick={() => pickMed(m)} disabled={medRun} style={{
                padding: "14px 4px", cursor: medRun ? "not-allowed" : "pointer",
                background: active ? `linear-gradient(135deg, ${G}33, ${G2}22)` : "rgba(0,0,0,0.35)",
                border: `1px solid ${active ? G : "#2a2a3a"}`,
                borderLeft: `3px solid ${active ? G : "#2a2a3a"}`,
                color: active ? "#fff" : "#aaa", fontFamily: "monospace",
                boxShadow: active ? `0 0 14px ${G}55` : "none",
                opacity: medRun && !active ? 0.4 : 1,
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: active ? G : "#ccc", textShadow: active ? `0 0 10px ${G}` : "none" }}>{m}</div>
                <div style={{ fontSize: 8, letterSpacing: 2, marginTop: 2 }}>MIN</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ ...CARD, padding: "30px 14px 26px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 40%, ${G}22, transparent 60%)`, pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 2, height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", border: `1px dashed ${G}44`, animation: "ringSpin 20s linear infinite" }} />
          <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", border: `1px solid ${G2}33`, animation: "ringSpin 30s linear infinite reverse" }} />
          <div style={{
            width: 160, height: 160, borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, ${G}, ${G2} 60%, #0a0a25 100%)`,
            animation: medRun
              ? (medPhase === "inhale" ? "breatheIn 4s ease-in-out forwards"
                : medPhase === "exhale" ? "breatheOut 4s ease-in-out forwards"
                : "breatheHold 4s ease-in-out forwards")
              : "none",
            transform: medRun ? undefined : "scale(0.75)",
            boxShadow: `0 0 80px ${G}, 0 0 160px ${G2}66`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: medRun ? undefined : "transform 0.4s ease",
          }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 4, color: "#fff", textShadow: "0 0 10px #000" }}>
              {medRun ? medPhaseLabel : "READY"}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 44, fontWeight: 900, color: "#fff", letterSpacing: 4, marginTop: 6, textShadow: `0 0 18px ${G}`, fontVariantNumeric: "tabular-nums" }}>
          {fmtT(medLeft)}
        </div>
        <div style={{ fontSize: 10, letterSpacing: 3, color: G, marginBottom: 14 }}>
          {medRun ? "◉ IN SESSION" : "○ PAUSED"}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={() => setMedRun(r => !r)} style={{
            padding: "12px 28px", cursor: "pointer",
            background: `linear-gradient(135deg, ${G}, ${G2})`,
            border: "none", color: "#000", fontFamily: "monospace",
            fontSize: 12, fontWeight: 900, letterSpacing: 3,
            boxShadow: `0 0 20px ${G}88`,
          }}>
            {medRun ? "❚❚ PAUSE" : "▶ BEGIN"}
          </button>
          <button onClick={() => { setMedRun(false); med.pickMed(medMin); }} style={{
            padding: "12px 20px", cursor: "pointer",
            background: "transparent", border: `1px solid ${G}66`,
            color: G, fontFamily: "monospace",
            fontSize: 12, fontWeight: 700, letterSpacing: 3,
          }}>
            ↻ RESET
          </button>
        </div>
      </div>

      <div style={CARD}>
        <div style={TITLE}><span style={{ color: G }}>▸</span> STILLNESS <span style={{ color: G }}>LEDGER</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[{ v: medSessions, l: "SESSIONS" }, { v: `${medTotal}m`, l: "TOTAL" }, { v: `+${medMin * 2}`, l: "NEXT REWARD" }].map((s, i) => (
            <div key={i} style={{ background: `linear-gradient(135deg, ${G}15, transparent)`, border: `1px solid ${G}33`, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: G, textShadow: `0 0 10px ${G}77` }}>{s.v}</div>
              <div style={{ fontSize: 8, letterSpacing: 2, color: "#888", marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: 12, background: "rgba(0,0,0,0.35)", border: `1px solid ${G}22`, borderLeft: `2px solid ${G}` }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: G, marginBottom: 4 }}>◈ THE STILL MIND</div>
          <div style={{ fontSize: 12, color: "#ddd", lineHeight: 1.5, fontStyle: "italic" }}>
            "The quieter you become, the more you can hear. In the storm of the world, silence is your superpower."
          </div>
        </div>
      </div>
    </>
  );
}
