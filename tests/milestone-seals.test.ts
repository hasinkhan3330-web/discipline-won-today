import { expect, test } from "bun:test";
import { milestoneSealTier, qualifyingMilestoneSeals } from "../src/lib/milestone-seals";

for (const [coins, expected] of [
  [349, []], [350, [7]], [1049, [7]], [1050, [7, 21]],
  [4999, [7, 21]], [5000, [7, 21, 100]],
  [14499, [7, 21, 100]], [14500, [7, 21, 100, 290]],
  [18249, [7, 21, 100, 290]], [18250, [7, 21, 100, 290, 365]],
] as [number, number[]][]) {
  test(`${coins} coins qualifies exactly the required milestones`, () => {
    expect(qualifyingMilestoneSeals(coins)).toEqual(expected);
  });
}

for (const [milestone, tier] of [[7, "bronze"], [21, "silver"], [100, "gold"], [290, "amethyst"], [365, "diamond"]] as const) {
  test(`Rank server milestone ${milestone} displays ${tier}`, () => {
    expect(milestoneSealTier(milestone)).toBe(tier);
  });
}
test("Rank without a qualifying server milestone has no badge", () => {
  expect(milestoneSealTier(null)).toBeNull();
  expect(milestoneSealTier(0)).toBeNull();
});