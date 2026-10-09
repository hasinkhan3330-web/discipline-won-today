export const MILESTONE_SEALS = [
  { days: 7, coins: 350, tier: "bronze", name: "Dark Bronze" },
  { days: 21, coins: 1050, tier: "silver", name: "Dark Silver" },
  { days: 100, coins: 5000, tier: "gold", name: "Dark Gold" },
  { days: 290, coins: 14500, tier: "amethyst", name: "Dark Amethyst" },
  { days: 365, coins: 18250, tier: "diamond", name: "Dark Diamond" },
] as const;

export type MilestoneSealTier = typeof MILESTONE_SEALS[number]["tier"];
export type MilestoneSealRecord = { milestone: number; unlocked_at: string };

/** Reference thresholds for tests; UI entitlement always comes from the server. */
export function qualifyingMilestoneSeals(coins: number) {
  return MILESTONE_SEALS.filter(seal => coins >= seal.coins).map(seal => seal.days);
}