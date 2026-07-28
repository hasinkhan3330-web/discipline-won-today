import type { CSSProperties } from "react";

export const cardStyle = (G: string): CSSProperties => ({
  background: "rgba(10,10,25,0.55)",
  backdropFilter: "blur(12px)",
  border: `1px solid ${G}33`,
  borderLeft: `2px solid ${G}`,
  padding: 14,
  marginBottom: 12,
  boxShadow: `0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 ${G}22`,
  borderRadius: 2,
});

export const titleStyle: CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: 3, color: "#e8e8e8",
  marginBottom: 12, fontFamily: "monospace",
  display: "flex", alignItems: "center", gap: 6,
};
