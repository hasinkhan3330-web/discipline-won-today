import type { ReactNode } from "react";
import { AX } from "@/tabs/styles";

/** Consistent "nothing here yet" block: one line of context + one clear action. */
export function EmptyState({
  title,
  line,
  cta,
  onCta,
  icon,
}: {
  title: string;
  line: string;
  cta?: string;
  onCta?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div style={{
      padding: "18px 16px", borderRadius: AX.radiusSm, background: "#181820",
      border: `1px dashed ${AX.border}`, textAlign: "center",
    }}>
      {icon && <div style={{ color: AX.muted, display: "flex", justifyContent: "center", marginBottom: 8 }}>{icon}</div>}
      <div style={{ fontSize: 14, fontWeight: 600, color: AX.text }}>{title}</div>
      <div style={{ fontSize: 13, color: AX.muted, marginTop: 4, lineHeight: 1.5 }}>{line}</div>
      {cta && onCta && (
        <button
          onClick={onCta}
          style={{
            marginTop: 12, minHeight: 44, padding: "10px 18px", borderRadius: 12, cursor: "pointer",
            background: AX.accent, border: `1px solid ${AX.accent}`, color: "#FFFFFF",
            fontFamily: AX.font, fontSize: 13, fontWeight: 600,
          }}
        >
          {cta}
        </button>
      )}
    </div>
  );
}
