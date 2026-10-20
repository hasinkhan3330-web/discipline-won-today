import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WAKE_PUSH_KEYS, wakePushMessage } from "../src/lib/wake-push.server";

const PRIVATE = ["question_answer", "question_hash", "question_explanation", "correct_answer", "answer", "hash", "explanation"];
const QUESTION_FIELDS = ["id", "version", "text", "options", "type", "correct_in_row"];

test("push payload carries only eventId, round and url, even when the job row has extra fields", () => {
  const job = { id: "j", event_id: "e1", round: 4, lease_token: "l", subscription_id: "s", endpoint: "https://fcm.googleapis.com/x", p256dh: "p", auth: "a",
    question_answer: "2", question_hash: "deadbeef", question_explanation: "secret why", question_text: "Q?" } as never;
  const body = wakePushMessage(job);
  expect(Object.keys(body).sort()).toEqual([...WAKE_PUSH_KEYS].sort());
  expect(body).toEqual({ eventId: "e1", round: 4, url: "/alarm" });
  const text = JSON.stringify(body);
  for (const k of PRIVATE) expect(text.includes(k)).toBe(false);
  for (const v of ["deadbeef", "secret why", "Q?"]) expect(text.includes(v)).toBe(false);
  // No question content at all — stricter than the question-field allowlist.
  for (const k of QUESTION_FIELDS) expect(Object.keys(body).includes(k)).toBe(false);
  console.log("  push payload keys:", Object.keys(body).join(","));
});

test("service worker notification uses fixed text and forwards only eventId, round and url", () => {
  const sw = readFileSync(join(import.meta.dir, "..", "public", "wake-service-worker.js"), "utf8");
  expect(sw).toContain('body: "Your wake alarm is ringing. Solve the challenge in AXEN."');
  expect(sw).toContain('data: { eventId: data.eventId, round: data.round, url: "/alarm" }');
  const readsFromPayload = [...sw.matchAll(/data\.(\w+)/g)].map(m => m[1]);
  expect([...new Set(readsFromPayload)].sort()).toEqual(["eventId", "round"]);
  expect(/addEventListener\(\s*["']fetch/.test(sw)).toBe(false); // no request interception or caching
  expect(/caches\./.test(sw)).toBe(false);
});
