import { useState } from "react";
import { AX, cardStyle, titleStyle } from "@/tabs/styles";
import { ChevronDown, Shield } from "lucide-react";
import { haptic } from "@/lib/haptics";

export const SHIELD_COST = 150;
export const SHIELD_MAX = 3;

export function ShieldCard({ shields, coins, onBuy }: {
  shields: number;
  coins: number;
  onBuy: () => Promise<void>;
}) {
  const CARD = cardStyle();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const full = shields >= SHIELD_MAX;
  const poor = coins < SHIELD_COST;
  const disabled = busy || full || poor;

  const buy = async () => {
    if (disabled) return;
    setBusy(true);
    haptic("tap");
    try { await onBuy(); } finally { setBusy(false); }
  };

  return (
    <div style={{ ...CARD, padding: 0, marginBottom: 8, borderColor: `${AX.cyan}35`, boxShadow: `inset 0 1px 0 ${AX.cyan}12` }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        style={{ ...titleStyle, width: "100%", minHeight: 46, margin: 0, padding: "10px 12px", background: "transparent", border: 0, color: AX.text, cursor: "pointer", fontFamily: AX.font }}
      >
        <Shield size={17} strokeWidth={1.8} color={AX.cyan} />
        <span style={{ flex: 1, textAlign: "left" }}>Streak shields</span>
        <span style={{ color: AX.muted, fontSize: 12 }}>{shields}/{SHIELD_MAX}</span>
        <ChevronDown size={16} color={AX.cyan} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .25s ease" }} />
      </button>
      <div className={`ax-collapse-grid ${open ? "ax-collapse-grid--open" : ""}`} aria-hidden={!open}>
       <div><div style={{ padding: "0 12px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
           width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: "#1D1D28", border: `1px solid ${AX.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: shields > 0 ? AX.success : AX.muted,
        }}>
          <Shield size={21} strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
           <div style={{ fontSize: 15, fontWeight: 600, color: AX.text }}>
            {shields} / {SHIELD_MAX} held
          </div>
           <div style={{ fontSize: 12, color: AX.muted, marginTop: 2, lineHeight: 1.4 }}>
            {shields > 0
              ? "A shield is spent automatically if you miss a full day, keeping your streak alive."
              : "No shields. Miss a day and the streak resets to zero."}
          </div>
        </div>
      </div>

      <button
        onClick={buy}
        disabled={disabled}
        style={{
           width: "100%", minHeight: 40, marginTop: 10, borderRadius: 11,
          cursor: disabled ? "not-allowed" : "pointer",
          background: disabled ? "#181820" : AX.accent,
          border: `1px solid ${disabled ? AX.border : AX.accent}`,
          color: disabled ? AX.muted : "#FFFFFF",
          fontFamily: AX.font, fontSize: 14, fontWeight: 600,
          transition: "opacity .15s ease, transform .15s ease",
        }}
      >
        {busy ? "Buying…" : full ? "Shield stock full" : poor ? `Need ${SHIELD_COST - coins} more coins` : `Buy a shield · ${SHIELD_COST} coins`}
      </button>
      </div></div>
      </div>
    </div>
  );
}
