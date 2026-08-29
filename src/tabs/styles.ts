import type { CSSProperties } from "react";

/**
 * AXEN design system — one flat, minimal token set used by every page.
 * No gradients, no glow, no textures.
 */
export const AX = {
  bg: "#0A0A0F",
  surface: "#14141C",
  border: "#23232E",
  accent: "#6C5CE7",
  success: "#00E5A0",
  danger: "#FF3B5C",
  flame: "#FF6B35",
  text: "#F5F5F7",
  muted: "#8B8B9A",
  radius: 16,
  radiusSm: 14,
  font: `-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif`,
} as const;

/** Standard card surface. Accepts an ignored legacy accent argument. */
export const cardStyle = (_accent?: string): CSSProperties => ({
  background: AX.surface,
  border: `1px solid ${AX.border}`,
  borderRadius: AX.radius,
  padding: 18,
  marginBottom: 14,
});

export const titleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: 0,
  color: AX.text,
  marginBottom: 14,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

export const subText: CSSProperties = {
  fontSize: 13,
  color: AX.muted,
  lineHeight: 1.5,
};

export const buttonStyle = (variant: "primary" | "ghost" = "primary"): CSSProperties => ({
  padding: "12px 18px",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: AX.font,
  cursor: "pointer",
  transition: "opacity .15s ease, transform .15s ease",
  ...(variant === "primary"
    ? { background: AX.accent, border: `1px solid ${AX.accent}`, color: "#FFFFFF" }
    : { background: "transparent", border: `1px solid ${AX.border}`, color: AX.text }),
});
