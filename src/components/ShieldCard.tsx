import { useState } from "react";
import { AX, cardStyle, titleStyle } from "@/tabs/styles";
import { Shield } from "lucide-react";
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
    <div style={{ ...CARD }}>
      <div style={titleStyle}>Streak shields</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 14, flexShrink: 0,
          background: "#1D1D28", border: `1px solid ${AX.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: shields > 0 ? AX.success : AX.muted,
        }}>
          <Shield size={21} strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: AX.text }}>
            {shields} / {SHIELD_MAX} held
          </div>
          <div style={{ fontSize: 13, color: AX.muted, marginTop: 3, lineHeight: 1.5 }}>
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
          width: "100%", minHeight: 46, marginTop: 14, borderRadius: 12,
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
    </div>
  );
}
