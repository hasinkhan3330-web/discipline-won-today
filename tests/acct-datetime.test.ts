import { describe, expect, it } from "vitest";
import { toLocalInput } from "@/lib/verified/contracts";
import { addMinutesLocal, dayOffset, fmtLocal, fmtTime, from12, onDayOf, setTime12, to12 } from "@/components/verified/acct/datetime";

describe("New pact pickers keep the old datetime-local output", () => {
  it("12 AM is midnight and 12 PM is noon", () => {
    expect(from12(12, "AM")).toBe(0);
    expect(from12(12, "PM")).toBe(12);
    expect(from12(7, "PM")).toBe(19);
    expect(setTime12("2026-11-17T15:10", 12, 0, "AM")).toBe("2026-11-17T00:00");
    expect(setTime12("2026-11-17T03:10", 12, 30, "PM")).toBe("2026-11-17T12:30");
    expect(to12("2026-11-17T00:05")).toEqual({ h: 12, m: 5, ap: "AM" });
    expect(to12("2026-11-17T12:45")).toEqual({ h: 12, m: 45, ap: "PM" });
  });
  it("quick chips cross midnight onto the next day", () => {
    expect(addMinutesLocal("2026-11-17T23:45", 30)).toBe("2026-11-18T00:15");
    expect(addMinutesLocal("2026-11-17T22:00", 180)).toBe("2026-11-18T01:00");
    expect(addMinutesLocal("2026-12-31T23:30", 60)).toBe("2027-01-01T00:30");
  });
  it("output string is identical to toLocalInput of the same moment", () => {
    const d = new Date(2026, 10, 17, 19, 45);
    expect(setTime12(toLocalInput(d), 7, 45, "PM")).toBe(toLocalInput(d));
  });
  it("deadline next day keeps its clock time", () => {
    expect(onDayOf("2026-11-17T22:00", "2026-11-17T01:00", 1)).toBe("2026-11-18T01:00");
    expect(onDayOf("2026-11-30T22:00", "2026-11-17T01:00", 1)).toBe("2026-12-01T01:00");
    expect(dayOffset("2026-11-17T22:00", "2026-11-18T01:00")).toBe(1);
    expect(dayOffset("2026-11-17T22:00", "2026-11-17T23:00")).toBe(0);
  });
  it("readable format", () => {
    expect(fmtLocal("2026-11-17T19:45")).toBe("Tue 17 Nov · 7:45 PM");
    expect(fmtTime("2026-11-18T00:00")).toBe("12:00 AM");
    expect(fmtLocal("")).toBe("Pick a time");
  });
});
