/** Device queue of offline wake claims (Capacitor Preferences, shared with the offline fallback page). */
import { addClaim, removeClaim, type WakeClaim } from "./wake-offline-core";
import { prefGet, prefSet } from "./native-alarms";

export const CLAIMS_KEY = "axen.wake.claims";
export const CLAIMS_EVENT = "axen:wake-claims";
export type ClaimResult = { accepted: boolean; result: string; awarded: number };

export async function readClaims() { return prefGet<WakeClaim[]>(CLAIMS_KEY, []); }
export async function queueClaim(claim: WakeClaim) {
  await prefSet(CLAIMS_KEY, addClaim(await readClaims(), claim));
  window.dispatchEvent(new Event(CLAIMS_EVENT));
}

let syncing = false;
/** Sends queued claims; a claim is removed once the server answers (accepted or rejected), kept on network errors. */
export async function syncClaims(send: (c: WakeClaim) => Promise<ClaimResult>, report: (c: WakeClaim, r: ClaimResult) => void) {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    for (const claim of await readClaims()) {
      let r: ClaimResult;
      try { r = await send(claim); } catch { break; }
      await prefSet(CLAIMS_KEY, removeClaim(await readClaims(), claim));
      report(claim, r);
    }
  } finally { syncing = false; window.dispatchEvent(new Event(CLAIMS_EVENT)); }
}
