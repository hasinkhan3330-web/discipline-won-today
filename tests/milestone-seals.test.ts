import { expect, test } from "bun:test";
import { qualifyingMilestoneSeals } from "../src/lib/milestone-seals";

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