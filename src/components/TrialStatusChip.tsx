import { AX } from "@/tabs/styles";
import type { Entitlement } from "@/hooks/useEntitlement";

/**
 * Quiet trial status in the existing topbar style:
 *  - "Day X of 3" while the free trial is running (no popups, no nagging)
 *  - "Free access ended" once it lapses without a paid subscription
 *  - nothing at all for paying members
 */
export function TrialStatusChip({ ent, onUpgrade }: { ent: Entitlement; onUpgrade: () => void }) {
  if (ent.isLoading) return null;

  const paid = ent.isPremium && ent.trialDay === "expired";
  if (paid) return null;

  const onTrial = ent.trialDay === 1 || ent.trialDay === 2 || ent.trialDay === 3;
  const ended = !ent.isPremium;
  if (!onTrial && !ended) return null;

  const label = onTrial ? `Day ${ent.trialDay} of 3` : "Free access ended";
  const color = onTrial ? AX.muted : AX.accent;

  return (
    <button
      onClick={onUpgrade}
      style={{
        background: "#181820",
        border: `1px solid ${onTrial ? AX.border : `${AX.accent}55`}`,
        color,
        padding: "7px 12px",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: AX.font,
        borderRadius: 12,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}
