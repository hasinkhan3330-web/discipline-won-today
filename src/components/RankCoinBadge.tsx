export type RankCoinTier = "pink" | "green" | "red" | "diamond";

/**
 * Final mapping of server milestones (from rank_verification_badges, based on real coins):
 * 350 → pink, 1,050 and 5,000 → green (5,000 has no visual change), 14,500 → red, 18,250 → dark-blue diamond.
 */
export function rankCoinTier(milestone?: number | null): RankCoinTier | null {
  if (milestone === 365) return "diamond";
  if (milestone === 290) return "red";
  if (milestone === 100 || milestone === 21) return "green";
  if (milestone === 7) return "pink";
  return null;
}

export function RankCoinBadge({ milestone }: { milestone?: number | null }) {
  const tier = rankCoinTier(milestone);
  if (!tier) return null;
  return <span className={`rank-coin-badge rank-coin-badge--${tier}`} role="img" aria-label={`${tier === "diamond" ? "dark blue diamond" : tier} verified badge`}>
    {tier === "diamond"
      ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3h11L23 9.5 12 22 1 9.5z" fill="currentColor" /><path d="m7.4 10.6 3.1 3 6.1-5.9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 12.5 3.6 3.5L17.5 8.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
  </span>;
}

/** Simple circular photo; the badge sits next to the name, never on the photo. */
export function RankCoinAvatar({ name, src, className = "" }: { name: string; src: string; milestone?: number | null; className?: string }) {
  return <span className={`rank-coin-avatar ${className}`}><img src={src} alt={name} loading="lazy" /></span>;
}
