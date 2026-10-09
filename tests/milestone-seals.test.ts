import { expect, test } from "bun:test";
import { highestMilestoneSeal, milestoneSealTier, qualifyingMilestoneSeals } from "../src/lib/milestone-seals";

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

for (const [coins, tier] of [[0,null],[349,null],[350,"bronze"],[400,"bronze"],[1049,"bronze"],[1050,"silver"],[5000,"gold"],[14500,"amethyst"],[18250,"diamond"]] as const) {
  test(`${coins} member coins shows only ${tier ?? "no seal"}`, () => {
    expect(highestMilestoneSeal(coins)?.tier ?? null).toBe(tier);
  });
}
test("server earned diamond remains at zero coins", () => {
  expect(highestMilestoneSeal(0, "diamond")?.tier).toBe("diamond");
});
test("current qualifying gold supersedes an older bronze record", () => {
  expect(highestMilestoneSeal(5000, "bronze")?.tier).toBe("gold");
});