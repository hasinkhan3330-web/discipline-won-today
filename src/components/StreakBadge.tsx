import type { MilestoneTone } from "@/lib/economy";

/** Glossy achievement check badge; diamond shape for the 365-day tier. */
export function StreakBadge({ tone, size = 16, label }: { tone: MilestoneTone; size?: number; label?: string }) {
  return (
    <span className={`ax-sbadge ax-sbadge--${tone}`} style={{ width: size, height: size }} role="img" aria-label={label ?? `${tone} streak badge`}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}
