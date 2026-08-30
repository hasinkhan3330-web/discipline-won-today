/**
 * Tiny haptic helper. Silently no-ops on devices/browsers without
 * the Vibration API (iOS Safari, desktop) — never throws.
 */
type Pattern = "tap" | "success" | "warn";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 12,
  success: [14, 40, 22],
  warn: [8, 30, 8],
};

export function haptic(kind: Pattern = "tap") {
  try {
    if (typeof navigator === "undefined") return;
    const v = (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate;
    if (typeof v !== "function") return;
    v.call(navigator, PATTERNS[kind]);
  } catch {
    /* unsupported — ignore */
  }
}
