/**
 * Offline handling for wake answers. A queued answer lives only in memory on the alarm screen
 * (nothing is written to device storage) and is never treated as a solve: the alarm stops only
 * when the server confirms `solved`.
 */
export type PendingAnswer = { eventId: string; version: number; answer: string };
export type SendOutcome<T> =
  | { kind: "sent"; response: T }
  | { kind: "queued" }
  | { kind: "rejected"; message: string; retry?: boolean };

/** Messages the wake server raises on purpose; anything else (e.g. raw database errors) is never shown. */
const KNOWN_SERVER_MESSAGES = /^(Challenge changed\. Reload the current question\.|Please wait before another answer|invalid answer|alarm not found|not authenticated)$/;
export const WAKE_FRIENDLY_ERROR = "Couldn't verify just now, retrying… The alarm keeps ringing until it's confirmed.";
export const WAKE_SERVER_RETRIES = 3;

const OFFLINE_MESSAGE = /failed to fetch|load failed|networkerror|network request failed|network connection was lost|internet connection appears to be offline/i;

/** True only for "the request could not reach the server"; server rejections are not retried. */
export function isConnectionFailure(reason: unknown, online: boolean): boolean {
  if (!online) return true;
  if (reason instanceof TypeError) return true;
  const message = reason instanceof Error ? reason.message : String(reason ?? "");
  return OFFLINE_MESSAGE.test(message);
}

export const WAKE_RETRY_BASE_MS = 2000;
export const WAKE_RETRY_MAX_MS = 30000;
/** Retry wait after the nth failed attempt (1-based): 2s, 4s, 8s, 16s, then 30s. */
export function retryDelayMs(attempt: number): number {
  return Math.min(WAKE_RETRY_MAX_MS, WAKE_RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1));
}

export async function trySendAnswer<T>(item: PendingAnswer, submit: (item: PendingAnswer) => Promise<T>, online: () => boolean): Promise<SendOutcome<T>> {
  if (!online()) return { kind: "queued" };
  try {
    return { kind: "sent", response: await submit(item) };
  } catch (reason) {
    if (isConnectionFailure(reason, online())) return { kind: "queued" };
    const raw = reason instanceof Error ? reason.message : String(reason ?? "");
    if (KNOWN_SERVER_MESSAGES.test(raw)) return { kind: "rejected", message: raw };
    console.error("[wake] answer verification failed", reason);
    return { kind: "rejected", message: WAKE_FRIENDLY_ERROR, retry: true };
  }
}
