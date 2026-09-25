import { describe, it, expect, vi, beforeEach } from "vitest";
const scheduled = new Map<number, any>();
let perm: "scheduled" | "denied" = "scheduled";
vi.mock("@/lib/local-notifications", async () => {
  const real = await vi.importActual<any>("@/lib/local-notifications");
  return {
    stableNotificationId: real.stableNotificationId,
    cancelLocalReminder: vi.fn(async (id: number) => { scheduled.delete(id); }),
    scheduleLocalReminder: vi.fn(async (r: any) => { if (perm === "denied") return "denied"; scheduled.set(r.id, r); return "scheduled"; }),
  };
});
import { scheduleContractReminders, contractNotificationIds } from "../contract-reminders";
const row = (at: string, extra: any = {}) => ({ id: "c-1", title: "Study", scheduled_at: at, reminder_pref: "standard", ...extra }) as any;
const future = (min: number) => new Date(Date.now() + min * 60000).toISOString();
beforeEach(() => { scheduled.clear(); perm = "scheduled"; });

describe("contract reminders", () => {
  it("1 permission ok → prep + start scheduled at right times", async () => {
    const at = future(60);
    expect(await scheduleContractReminders(row(at))).toBe("scheduled");
    const [p, s] = contractNotificationIds("c-1");
    expect(scheduled.get(s).at.toISOString()).toBe(at);
    expect(scheduled.get(p).at.getTime()).toBe(new Date(at).getTime() - 5 * 60000);
  });
  it("2 permission denied → returns denied (fallback), no throw", async () => {
    perm = "denied";
    expect(await scheduleContractReminders(row(future(60)))).toBe("denied");
    expect(scheduled.size).toBe(0);
  });
  it("3 reschedule → old replaced, still 2", async () => {
    await scheduleContractReminders(row(future(60)));
    const later = future(180);
    await scheduleContractReminders(row(later));
    expect(scheduled.size).toBe(2);
    expect(scheduled.get(contractNotificationIds("c-1")[1]).at.toISOString()).toBe(later);
  });
  it("4 restart re-run → no duplicates", async () => {
    const at = future(60);
    for (let i = 0; i < 3; i++) await scheduleContractReminders(row(at));
    expect(scheduled.size).toBe(2);
  });
  it("5 DST: UTC instant preserved across a DST switch timezone", async () => {
    const at = "2099-03-09T07:30:00.000Z"; // after US spring-forward
    await scheduleContractReminders(row(at, { timezone: "America/New_York" }));
    expect(scheduled.get(contractNotificationIds("c-1")[1]).at.toISOString()).toBe(at);
  });
  it("6 IDs stable and distinct", () => {
    expect(contractNotificationIds("c-1")).toEqual(contractNotificationIds("c-1"));
    expect(new Set(contractNotificationIds("c-1")).size).toBe(2);
    expect(contractNotificationIds("c-2")).not.toEqual(contractNotificationIds("c-1"));
  });
});
