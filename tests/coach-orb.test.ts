import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatPillDate, pillText } from "@/components/coach/orb/CoachOrbScreen";

describe("coach orb pill", () => {
  it("formats DD Mon YYYY", () => expect(formatPillDate("2027-08-09T12:00:00")).toBe("09 Aug 2027"));
  it("active when end is in future", () => expect(pillText({ status: "active", current_period_end: "2027-08-09T12:00:00" }, new Date("2026-11-09"))).toBe("Active · 09 Aug 2027"));
  it("expired when end passed", () => expect(pillText({ status: "active", current_period_end: "2026-01-05T12:00:00" }, new Date("2026-11-09"))).toBe("Expired · 05 Jan 2026"));
  it("free without subscription", () => expect(pillText(null)).toBe("Free"));
});

describe("orb motion and voice safety", () => {
  const orb = readFileSync("src/components/coach/orb/OrbCanvas.tsx", "utf8");
  const voice = readFileSync("src/components/VoiceCoach.tsx", "utf8");
  it("clamps radial motion to 1.1x and uses 450 points", () => { expect(orb).toContain("if (f > 1.1) f = 1.1"); expect(orb).toContain("N = 450"); });
  it("has no simulated levels", () => expect(orb).not.toMatch(/Math\.sin\(t \* 3\.2\)|Math\.sin\(t \* 6\)/));
  it("mic analyser is a side branch only", () => { expect(voice).toContain("source.connect(tap)"); expect(voice).not.toMatch(/tap\.connect\(/); });
  it("keeps the 16k/24k pipeline", () => { expect(voice).toContain("sampleRate: 16000"); expect(voice).toContain("new PcmPlayer(24000)"); });
});
