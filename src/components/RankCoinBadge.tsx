export type RankCoinTier = "pink" | "green" | "blue" | "black" | "goat";

export function rankCoinTier(milestone?: number | null): RankCoinTier | null {
  if (milestone === 365) return "goat";
  if (milestone === 290) return "black";
  if (milestone === 100) return "blue";
  if (milestone === 21) return "green";
  if (milestone === 7) return "pink";
  return null;
}

export function RankCoinBadge({ milestone }: { milestone?: number | null }) {
  const tier = rankCoinTier(milestone);
  if (!tier) return null;
  return <span className={`rank-coin-badge rank-coin-badge--${tier}`} role="img" aria-label={`${tier === "goat" ? "GOAT" : tier} verified coin badge`}>
    {tier === "goat" ? <span aria-hidden="true">🐐</span> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.4 4.3L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
  </span>;
}

export function RankCoinAvatar({ name, src, milestone, className = "" }: { name: string; src: string; milestone?: number | null; className?: string }) {
  const tier = rankCoinTier(milestone);
  return <span className={`rank-coin-avatar ${tier ? `rank-coin-avatar--${tier}` : ""} ${className}`}>
    <img src={src} alt={name} loading="lazy" />
    <RankCoinBadge milestone={milestone} />
  </span>;
}