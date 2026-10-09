import { MilestoneSeal } from "@/components/MilestoneSeal";
import { milestoneSealTier, type MilestoneSealTier } from "@/lib/milestone-seals";

export type RankCoinTier = MilestoneSealTier;
export const rankCoinTier = milestoneSealTier;

export function RankCoinBadge({ milestone }: { milestone?: number | null }) {
  const tier = rankCoinTier(milestone);
  if (!tier) return null;
  return <MilestoneSeal tier={tier} className="rank-metallic-badge" label={`${tier} coin badge`} />;
}

/** Simple circular photo; the badge sits next to the name, never on the photo. */
export function RankCoinAvatar({ name, src, className = "" }: { name: string; src: string; milestone?: number | null; className?: string }) {
  return <span className={`rank-coin-avatar ${className}`}><img src={src} alt={name} loading="lazy" /></span>;
}
