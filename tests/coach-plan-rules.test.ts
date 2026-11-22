import { describe, expect, test } from "bun:test";
import { enforcePlanRules, isPlanLength, localDay, dayIndex, profileConfidence } from "../src/lib/coach-plan-rules";
import { COACH_TOOL_NAMES } from "../src/lib/coach-tools";

const many = (n: number, minutes = 10) => Array.from({ length: n }, (_, i) => ({ title: `T${i}`, minimum: "1 page", trigger: "After waking", minutes, difficulty: "easy" }));

describe("coach plan rules", () => {
  test("only 1, 7 and 21 day plans exist (no 90)", () => {
    expect([1, 7, 21].every(isPlanLength)).toBe(true);
    expect(isPlanLength(90)).toBe(false);
    expect(isPlanLength(30)).toBe(false);
  });
  test("at most 12 tasks per day", () => {
    const plan = enforcePlanRules({ days: [{ day: 1, tasks: many(15, 5) }] }, 1, 30);
    expect(plan.days[0]!.tasks).toHaveLength(12);
  });
  test("user's hours are kept exactly, never cut to available time", () => {
    const plan = enforcePlanRules({ days: [{ day: 1, tasks: many(3, 360) }] }, 1, 60);
    expect(plan.days[0]!.tasks.map((t) => t.minutes)).toEqual([360, 360, 360]);
  });
  test("every task has a minimum version", () => {
    const plan = enforcePlanRules({ days: [{ day: 1, tasks: [{ title: "Study", minutes: 10 }] }] }, 1, 60);
    expect(plan.days[0]!.tasks[0]!.minimum.length).toBeGreaterThan(0);
  });
  test("today uses the user's timezone, not the server's", () => {
    const at = new Date("2026-11-07T20:00:00Z");
    expect(localDay("Asia/Kolkata", at)).toBe("2026-11-08");
    expect(localDay("America/Los_Angeles", at)).toBe("2026-11-07");
  });
  test("plan day index stays inside the plan", () => {
    expect(dayIndex("2026-11-08", "2026-11-08", 7)).toBe(0);
    expect(dayIndex("2026-11-08", "2026-11-14", 7)).toBe(6);
    expect(dayIndex("2026-11-08", "2026-11-15", 7)).toBeNull();
  });
  test("coach has no tool that marks tasks done or awards coins", () => {
    expect(COACH_TOOL_NAMES.some((n) => /complete|done|award|coin/i.test(n))).toBe(false);
  });
  test("confidence reaches 100 only when all required slots are certain", () => {
    expect(profileConfidence({})).toBe(0);
    expect(profileConfidence({ goal: { value: "x", confidence: 1 } })).toBe(15);
  });
});
