import { describe, expect, it } from "vitest";
import { firstName, inviteLink, isStageUp, pickHomePriority, shouldShowMilestone } from "../src/components/verified/acct/home-priority";
const base = { missed: false, dueToday: false, checkinDue: false, partnerCheer: false, hasGarden: false };
describe("Accountability home priority", () => {
  it("missed beats everything", () => expect(pickHomePriority({ missed: true, dueToday: true, checkinDue: true, partnerCheer: true, hasGarden: true })).toBe("missed"));
  it("due > check-in > cheer > garden", () => {
    expect(pickHomePriority({ ...base, dueToday: true, checkinDue: true })).toBe("due");
    expect(pickHomePriority({ ...base, checkinDue: true, partnerCheer: true })).toBe("checkin");
    expect(pickHomePriority({ ...base, partnerCheer: true, hasGarden: true })).toBe("cheer");
    expect(pickHomePriority({ ...base, hasGarden: true })).toBe("garden");
  });
  it("empty when nothing", () => expect(pickHomePriority(base)).toBe("empty"));
});
describe("milestones", () => {
  it("only 3/7/14/30, once per device", () => {
    expect(shouldShowMilestone(7, () => false)).toBe(true);
    expect(shouldShowMilestone(7, k => k === "pair.7")).toBe(false);
    expect(shouldShowMilestone(5, () => false)).toBe(false);
  });
  it("stage-up needs a stored lower stage", () => {
    expect(isStageUp(null, 3)).toBe(false);
    expect(isStageUp(2, 3)).toBe(true);
    expect(isStageUp(3, 3)).toBe(false);
  });
});
describe("invite + names", () => {
  it("builds /join link", () => expect(inviteLink("https://axonhabit.app", "AB12")).toBe("https://axonhabit.app/join/AB12"));
  it("first name never an email", () => { expect(firstName("Riya Sharma")).toBe("Riya"); expect(firstName("a@b.com")).toBeNull(); });
});
