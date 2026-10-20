import { expect, test } from "bun:test";
import { isConnectionFailure, retryDelayMs, trySendAnswer, type PendingAnswer } from "../src/lib/wake-answer-queue";

const item: PendingAnswer = { eventId: "00000000-0000-4000-8000-000000000001", version: 3, answer: "2" };

test("offline device queues the answer without calling the server", async () => {
  let calls = 0;
  const outcome = await trySendAnswer(item, async () => { calls++; return { solved: true }; }, () => false);
  expect(outcome.kind).toBe("queued");
  expect(calls).toBe(0);
});

test("a dropped connection mid-request queues the answer instead of failing silently", async () => {
  const outcome = await trySendAnswer(item, async () => { throw new TypeError("Failed to fetch"); }, () => true);
  expect(outcome.kind).toBe("queued");
});

test("a server rejection is reported and never retried", async () => {
  const outcome = await trySendAnswer(item, async () => { throw new Error("Challenge changed. Reload the current question."); }, () => true);
  expect(outcome).toEqual({ kind: "rejected", message: "Challenge changed. Reload the current question." });
  expect(isConnectionFailure(new Error("Please wait before another answer"), true)).toBe(false);
});

test("queued answer is only a solve when the server says so", async () => {
  const outcome = await trySendAnswer(item, async () => ({ solved: false, correct: true }), () => true);
  expect(outcome).toEqual({ kind: "sent", response: { solved: false, correct: true } });
});

test("retry backoff is 2s, 4s, 8s, 16s then capped at 30s", () => {
  expect([1, 2, 3, 4, 5, 9].map(retryDelayMs)).toEqual([2000, 4000, 8000, 16000, 30000, 30000]);
});
