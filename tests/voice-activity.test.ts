import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/components/VoiceCoach.tsx", import.meta.url), "utf8");

test("voice client never sends activityStart/activityEnd (automatic detection stays enabled)", () => {
  expect(src).not.toMatch(/activityStart|activityEnd/);
  expect(src).not.toMatch(/automaticActivityDetection\s*:\s*\{\s*disabled\s*:\s*true/);
});
test("mic stop sends only audioStreamEnd", () => {
  expect(src).toContain("audioStreamEnd: true");
});
test("raw Google errors are not shown; one reconnect message instead", () => {
  expect(src).toContain("Coach lost connection, reconnecting...");
  expect(src).not.toMatch(/setError\(friendly\)|event\.reason \|\|/);
});
