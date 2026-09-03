import { useState } from "react";
import { AX } from "@/tabs/styles";
import { getSimMode, setSimMode, type SimMode } from "@/hooks/useEntitlement";

const MODES: { id: SimMode; label: string }[] = [
  { id: "off", label: "Real" },
  { id: "day1", label: "Day 1" },
  { id: "day2", label: "Day 2" },
  { id: "day3", label: "Day 3" },
  { id: "expired", label: "Expired" },
  { id: "active-sub", label: "Active sub" },
  { id: "expired-sub", label: "Expired sub" },
];

/**
 * Dev-only entitlement simulator. Compiled out of production builds
 * (import.meta.env.DEV) and purely presentational: it changes what the client
 * *renders*, never what the server grants — no security surface.
 */
export function DevTrialSimulator() {
  const [mode, setMode] = useState<SimMode>(() => getSimMode());
  const [open, setOpen] = useState(false);
  if (!import.meta.env.DEV) return null;

  return (
    <div style={{ position: "fixed", left: 8, bottom: 74, zIndex: 150, fontFamily: AX.font }}>
      {open ? (
        <div style={{ background: AX.surface, border: `1px solid ${AX.border}`, borderRadius: 12, padding: 10, display: "flex", flexWrap: "wrap", gap: 6, maxWidth: 250 }}>
          <div style={{ width: "100%", fontSize: 10, color: AX.muted, marginBottom: 2 }}>DEV · simulate entitlement</div>
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setSimMode(m.id); }}
              style={{
                fontSize: 11, padding: "5px 8px", borderRadius: 8, cursor: "pointer",
                background: mode === m.id ? AX.accent : "transparent",
                color: mode === m.id ? "#fff" : AX.muted,
                border: `1px solid ${mode === m.id ? AX.accent : AX.border}`,
                fontFamily: AX.font,
              }}
            >{m.label}</button>
          ))}
          <button onClick={() => setOpen(false)} style={{ fontSize: 11, color: AX.muted, background: "transparent", border: "none", cursor: "pointer", marginLeft: "auto" }}>close</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{ fontSize: 10, padding: "5px 8px", borderRadius: 8, background: AX.surface, color: AX.muted, border: `1px solid ${AX.border}`, cursor: "pointer", fontFamily: AX.font }}>
          DEV{mode !== "off" ? ` · ${mode}` : ""}
        </button>
      )}
    </div>
  );
}
