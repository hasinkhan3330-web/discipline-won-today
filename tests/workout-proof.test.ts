import { describe, expect, test } from "bun:test";
import {
  WORKOUT_DAILY_COIN_CAP,
  WORKOUT_PROOF_COINS,
  buildWorkoutAuditPrompt,
  computeWorkoutReward,
  parseAuditVerdict,
} from "../src/lib/workout-proof.functions";

describe("workout proof rules", () => {
  test("awards 10 coins once per day and respects the 50-coin daily cap", () => {
    expect(WORKOUT_PROOF_COINS).toBe(10);
    expect(WORKOUT_DAILY_COIN_CAP).toBe(50);
    expect(computeWorkoutReward(0, false)).toBe(10);
    expect(computeWorkoutReward(40, false)).toBe(10);
    expect(computeWorkoutReward(45, false)).toBe(5);
    expect(computeWorkoutReward(50, false)).toBe(0);
    expect(computeWorkoutReward(60, false)).toBe(0);
    expect(computeWorkoutReward(0, true)).toBe(0);
  });

  test("parses strict Gemini JSON verdict including fenced JSON and malformed output", () => {
    expect(parseAuditVerdict('{"verified": true, "reason": "Dumbbells visible in gym."}')).toEqual({
      verified: true,
      reason: "Dumbbells visible in gym.",
    });
    expect(
      parseAuditVerdict('```json\n{"verified": false, "reason": "Blank wall detected."}\n```'),
    ).toEqual({
      verified: false,
      reason: "Blank wall detected.",
    });
    expect(parseAuditVerdict("not json").verified).toBe(false);
  });

  test("embeds the user's workout type into the strict auditor prompt", () => {
    const prompt = buildWorkoutAuditPrompt("Pushups");
    expect(prompt).toContain('"Pushups"');
    expect(prompt).toContain("strict fitness discipline auditor");
  });
});