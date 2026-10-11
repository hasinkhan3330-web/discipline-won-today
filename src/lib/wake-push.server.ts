import { p256 } from "@noble/curves/nist.js";
import { buildPushPayload } from "@block65/webcrypto-web-push";

function b64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function wakeVapid() {
  const seed = process.env["WAKE_VAPID_SEED"];
  if (!seed) throw new Error("Push credentials are not configured");
  const raw = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)));
  // Cryptographically random stored seed deterministically derives a valid P-256 key; never logs either private value.
  return { publicKey: b64(p256.getPublicKey(raw, false)), privateKey: b64(raw), subject: "https://axonhabit.app" };
}
export type PushJob = { id: string; event_id: string; round: number; lease_token: string; subscription_id: string; endpoint: string; p256dh: string; auth: string };
export async function sendWakePush(job: PushJob) {
  const url = new URL(job.endpoint);
  const host = url.hostname;
  if (url.protocol !== "https:" || url.port || !(host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" || host.endsWith(".push.apple.com") || host.endsWith(".notify.windows.com"))) return 410;
  const payload = await buildPushPayload({ data: JSON.stringify({ eventId: job.event_id, round: job.round, url: "/alarm" }), options: { ttl: 60 } }, { endpoint: job.endpoint, expirationTime: null, keys: { p256dh: job.p256dh, auth: job.auth } }, await wakeVapid());
  try { return (await fetch(job.endpoint, { ...payload, signal: AbortSignal.timeout(8000), redirect: "error" })).status; } catch { return 0; }
}