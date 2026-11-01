import { describe, expect, test } from "bun:test";
import { trySendAnswer, WAKE_FRIENDLY_ERROR, WAKE_SERVER_RETRIES } from "../src/lib/wake-answer-queue";

const item = { eventId: "e", version: 1, answer: "Mercury" };
const fail = (m: string) => () => Promise.reject(new Error(m));

describe("wake answer error mapping", () => {
  test("raw database constraint errors are never shown and are retried", async () => {
    const r = await trySendAnswer(item, fail('new row for relation "score_events" violates check constraint "score_events_points_check"'), () => true);
    expect(r).toEqual({ kind: "rejected", message: WAKE_FRIENDLY_ERROR, retry: true });
  });
  test("intentional server messages pass through without retry", async () => {
    const r = await trySendAnswer(item, fail("Please wait before another answer"), () => true);
    expect(r).toEqual({ kind: "rejected", message: "Please wait before another answer" });
  });
  test("offline answers queue", async () => {
    expect((await trySendAnswer(item, fail("x"), () => false)).kind).toBe("queued");
  });
  test("server failures retry 3 times", () => expect(WAKE_SERVER_RETRIES).toBe(3));
});
