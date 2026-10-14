import { expect, test } from "bun:test";
import { wakeReward, wakeEligibility, nextWakeInstant, WAKE_MIN_LEAD_SECONDS, WAKE_SOLVE_WINDOW_SECONDS, WAKE_PUSH_MAX_ROUNDS, WAKE_MAX_REWARDED_PER_DAY } from "../src/lib/wake-rules";

for (const [time, coins] of [["03:59",0],["04:00",10],["04:59",10],["05:00",7],["05:59",7],["06:00",5],["06:59",5],["07:00",3],["07:59",3],["08:00",0],["23:59",0]] as const) {
  test(`${time} wake tier pays ${coins}`, () => expect(wakeReward(time)).toBe(coins));
}
test("named wake limits", () => expect([WAKE_MIN_LEAD_SECONDS,WAKE_SOLVE_WINDOW_SECONDS,WAKE_PUSH_MAX_ROUNDS,WAKE_MAX_REWARDED_PER_DAY]).toEqual([7200,1800,30,1]));
test("exact two-hour save and 30-minute solve eligible", () => expect(wakeEligibility(0,7200000,9000000,"04:00")).toBe("eligible"));
test("save one second short is ineligible", () => expect(wakeEligibility(1000,7200000,7200000,"04:00")).toBe("saved_too_late"));
test("solve one second late is ineligible", () => expect(wakeEligibility(0,7200000,9001000,"04:00")).toBe("solve_too_late"));
test("test never eligible", () => expect(wakeEligibility(0,7200000,7200000,"04:00",true)).toBe("test_alarm"));
test("outside reward hours still no reward", () => expect(wakeEligibility(0,7200000,7200000,"12:00")).toBe("outside_reward_window"));
test("Kolkata next local day", () => expect(new Date(nextWakeInstant(Date.parse("2026-10-14T00:00:00Z"),"04:00","Asia/Kolkata")).toISOString()).toBe("2026-10-14T22:30:00.000Z"));
test("DST gap moves to first valid local minute", () => expect(new Date(nextWakeInstant(Date.parse("2026-03-08T05:00:00Z"),"02:30","America/New_York")).toISOString()).toBe("2026-03-08T07:00:00.000Z"));
test("DST fold uses first occurrence once", () => expect(new Date(nextWakeInstant(Date.parse("2026-11-01T04:00:00Z"),"01:30","America/New_York")).toISOString()).toBe("2026-11-01T05:30:00.000Z"));
test("after first fold occurrence schedules next day", () => expect(new Date(nextWakeInstant(Date.parse("2026-11-01T05:40:00Z"),"01:30","America/New_York")).toISOString()).toBe("2026-11-02T06:30:00.000Z"));