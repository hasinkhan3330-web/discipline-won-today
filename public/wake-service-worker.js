/* Wake-only push worker. No caching, private page data or answer keys. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let data;
    try { data = event.data?.json(); } catch { return; }
    if (!data || typeof data.eventId !== "string" || !Number.isInteger(data.round)) return;
    const tag = `axen-wake-${data.eventId}`;
    const existing = await self.registration.getNotifications({ tag });
    if (existing.some(n => n.data?.round >= data.round)) return;
    await self.registration.showNotification("AXEN Wake Protocol", { body: "Your wake alarm is ringing. Solve the challenge in AXEN.", tag, renotify: true, requireInteraction: true, icon: "/favicon.png", data: { eventId: data.eventId, round: data.round, url: "/alarm" } });
  })());
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (client) { await client.navigate("/alarm"); await client.focus(); }
    else await self.clients.openWindow("/alarm");
  })());
});